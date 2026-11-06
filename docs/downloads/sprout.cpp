// Sprout: a complete teaching compiler. Baseline: ISO C++11.
#include <algorithm>
#include <cctype>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <limits>
#include <map>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

struct Pos {
    int line, col;
    Pos(int l = 1, int c = 1) : line(l), col(c) {}
};
struct Error : std::runtime_error {
    Pos pos;
    Error(Pos p, const std::string &m) : std::runtime_error(m), pos(p) {}
};
static void fail(Pos p, const std::string &m) { throw Error(p, m); }
struct Token {
    std::string kind, text;
    Pos pos;
    Token(std::string k, std::string t, Pos p) : kind(k), text(t), pos(p) {}
};

// Stage 1. Each token owns its spelling, so no string_view lifetime is involved.
class Lexer {
    const std::string &s;
    std::size_t at;
    Pos pos;
    char peek(std::size_t n = 0) const { return at + n < s.size() ? s[at + n] : '\0'; }
    char take() {
        char c = s[at++];
        if (c == '\n') {
            ++pos.line;
            pos.col = 1;
        } else
            ++pos.col;
        return c;
    }
    static bool alpha(char c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
    }
    static bool digit(char c) { return c >= '0' && c <= '9'; }

  public:
    explicit Lexer(const std::string &text) : s(text), at(0), pos() {}
    std::vector<Token> scan() {
        std::vector<Token> out;
        while (at < s.size()) {
            char c = peek();
            Pos p = pos;
            if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
                take();
                continue;
            }
            if (c == '/' && peek(1) == '/') {
                while (at < s.size() && peek() != '\n')
                    take();
                continue;
            }
            std::string text;
            if (alpha(c)) {
                do {
                    text += take();
                } while (alpha(peek()) || digit(peek()));
                const std::string words = " fn let if else while return print int bool true false ";
                out.push_back(Token(words.find(" " + text + " ") != std::string::npos ? text : "id",
                                    text, p));
                continue;
            }
            if (digit(c)) {
                do {
                    text += take();
                } while (digit(peek()));
                out.push_back(Token("num", text, p));
                continue;
            }
            std::string two;
            two += c;
            two += peek(1);
            if (two == "->" || two == "==" || two == "!=" || two == "<=" || two == ">=" ||
                two == "&&" || two == "||") {
                take();
                take();
                out.push_back(Token(two, two, p));
                continue;
            }
            if (std::string("(){}:;,+-*/%<>=!").find(c) != std::string::npos && c != '\0') {
                text += take();
                out.push_back(Token(text, text, p));
                continue;
            }
            fail(p, "unknown character (identifiers use ASCII letters, digits and underscore)");
        }
        out.push_back(Token("eof", "", pos));
        return out;
    }
};

enum Type { TInt, TBool };
static std::string typeName(Type t) { return t == TInt ? "int" : "bool"; }
struct Expr {
    enum Kind { Number, Boolean, Variable, Call, Unary, Binary } kind;
    Pos pos;
    std::string text;
    std::int64_t value;
    Type type;
    int index, height;
    std::vector<std::unique_ptr<Expr>> args;
    Expr(Kind k, Pos p, std::string t = "")
        : kind(k), pos(p), text(t), value(0), type(TInt), index(-1), height(1) {}
};
struct Stmt {
    enum Kind { Block, Let, Assign, Print, If, While, Return, Expression } kind;
    Pos pos;
    std::string name;
    int slot;
    std::unique_ptr<Expr> expr;
    std::vector<std::unique_ptr<Stmt>> children;
    Stmt(Kind k, Pos p) : kind(k), pos(p), slot(-1) {}
};
struct Param {
    std::string name;
    Type type;
    Pos pos;
    Param(std::string n, Type t, Pos p) : name(n), type(t), pos(p) {}
};
struct Function {
    std::string name;
    Pos pos;
    Type result;
    std::vector<Param> params;
    std::unique_ptr<Stmt> body;
    int locals;
    Function() : result(TInt), locals(0) {}
};
typedef std::vector<std::unique_ptr<Function>> Program;

// Stage 2. Recursive descent for statements; precedence climbing for expressions.
class Parser {
    const std::vector<Token> &ts;
    std::size_t at;
    int nesting;
    const Token &peek(std::size_t n = 0) const { return ts[std::min(at + n, ts.size() - 1)]; }
    Token take() { return ts[at++]; }
    bool accept(const std::string &k) {
        if (peek().kind == k) {
            ++at;
            return true;
        }
        return false;
    }
    Token expect(const std::string &k) {
        if (peek().kind != k)
            fail(peek().pos, "expected '" + k + "', got '" + peek().kind + "'");
        return take();
    }
    struct Nest {
        Parser &p;
        explicit Nest(Parser &q) : p(q) {
            if (++p.nesting > 256)
                fail(p.peek().pos, "syntax nesting exceeds 256");
        }
        ~Nest() { --p.nesting; }
    };
    Type parseType() {
        if (accept("int"))
            return TInt;
        if (accept("bool"))
            return TBool;
        fail(peek().pos, "expected type int or bool");
        return TInt;
    }
    static int precedence(const std::string &op) {
        if (op == "||")
            return 1;
        if (op == "&&")
            return 2;
        if (op == "==" || op == "!=")
            return 3;
        if (op == "<" || op == "<=" || op == ">" || op == ">=")
            return 4;
        if (op == "+" || op == "-")
            return 5;
        if (op == "*" || op == "/" || op == "%")
            return 6;
        return 0;
    }
    std::unique_ptr<Expr> number(Token t, bool negative = false) {
        std::int64_t n = 0;
        for (std::size_t i = 0; i < t.text.size(); ++i) {
            n = n * 10 + (t.text[i] - '0');
            if (n > 2147483648LL)
                fail(t.pos, "integer literal is outside int32 range");
        }
        if (!negative && n > 2147483647LL)
            fail(t.pos, "integer literal is outside int32 range");
        std::unique_ptr<Expr> e(new Expr(Expr::Number, t.pos));
        e->value = negative ? -n : n;
        return e;
    }
    static void checkHeight(Expr &e) {
        for (std::size_t i = 0; i < e.args.size(); ++i)
            e.height = std::max(e.height, e.args[i]->height + 1);
        if (e.height > 128)
            fail(e.pos, "expression tree depth exceeds 128");
    }
    std::unique_ptr<Expr> primary() {
        Nest guard(*this);
        Token t = peek();
        if (accept("num"))
            return number(t);
        if (accept("true") || accept("false")) {
            std::unique_ptr<Expr> e(new Expr(Expr::Boolean, t.pos));
            e->value = t.kind == "true";
            checkHeight(*e);
            return e;
        }
        if (accept("id")) {
            std::unique_ptr<Expr> e(new Expr(Expr::Variable, t.pos, t.text));
            if (accept("(")) {
                e->kind = Expr::Call;
                if (!accept(")")) {
                    do {
                        e->args.push_back(expression());
                    } while (accept(","));
                    expect(")");
                }
            }
            checkHeight(*e);
            return e;
        }
        if (accept("(")) {
            std::unique_ptr<Expr> e = expression();
            expect(")");
            return e;
        }
        if (accept("-") || accept("!")) {
            // This special case admits the only positive magnitude not representable as int32.
            if (t.kind == "-" && peek().kind == "num")
                return number(take(), true);
            std::unique_ptr<Expr> e(new Expr(Expr::Unary, t.pos, t.kind));
            e->args.push_back(primary());
            checkHeight(*e);
            return e;
        }
        fail(t.pos, "expected expression");
        return std::unique_ptr<Expr>();
    }
    std::unique_ptr<Expr> expression(int min = 1) {
        Nest guard(*this);
        std::unique_ptr<Expr> lhs = primary();
        while (precedence(peek().kind) >= min) {
            Token op = take();
            std::unique_ptr<Expr> e(new Expr(Expr::Binary, op.pos, op.kind));
            e->args.push_back(std::move(lhs));
            e->args.push_back(expression(precedence(op.kind) + 1));
            checkHeight(*e);
            lhs = std::move(e);
        }
        return lhs;
    }
    std::unique_ptr<Stmt> block() {
        Token p = expect("{");
        std::unique_ptr<Stmt> s(new Stmt(Stmt::Block, p.pos));
        while (peek().kind != "}" && peek().kind != "eof")
            s->children.push_back(statement());
        expect("}");
        return s;
    }
    std::unique_ptr<Stmt> statement() {
        Nest guard(*this);
        Token t = peek();
        if (t.kind == "{")
            return block();
        if (accept("let")) {
            std::unique_ptr<Stmt> s(new Stmt(Stmt::Let, t.pos));
            s->name = expect("id").text;
            expect("=");
            s->expr = expression();
            expect(";");
            return s;
        }
        if (accept("print")) {
            std::unique_ptr<Stmt> s(new Stmt(Stmt::Print, t.pos));
            expect("(");
            s->expr = expression();
            expect(")");
            expect(";");
            return s;
        }
        if (accept("return")) {
            std::unique_ptr<Stmt> s(new Stmt(Stmt::Return, t.pos));
            s->expr = expression();
            expect(";");
            return s;
        }
        if (accept("if") || accept("while")) {
            std::unique_ptr<Stmt> s(new Stmt(t.kind == "if" ? Stmt::If : Stmt::While, t.pos));
            expect("(");
            s->expr = expression();
            expect(")");
            s->children.push_back(block());
            if (t.kind == "if" && accept("else"))
                s->children.push_back(block());
            return s;
        }
        if (peek().kind == "id" && peek(1).kind == "=") {
            take();
            take();
            std::unique_ptr<Stmt> s(new Stmt(Stmt::Assign, t.pos));
            s->name = t.text;
            s->expr = expression();
            expect(";");
            return s;
        }
        std::unique_ptr<Stmt> s(new Stmt(Stmt::Expression, t.pos));
        s->expr = expression();
        expect(";");
        return s;
    }

  public:
    explicit Parser(const std::vector<Token> &tokens) : ts(tokens), at(0), nesting(0) {}
    Program parse() {
        Program p;
        while (peek().kind != "eof") {
            expect("fn");
            Token name = expect("id");
            std::unique_ptr<Function> f(new Function);
            f->name = name.text;
            f->pos = name.pos;
            expect("(");
            if (!accept(")")) {
                do {
                    Token param = expect("id");
                    expect(":");
                    Type type = parseType();
                    f->params.push_back(Param(param.text, type, param.pos));
                } while (accept(","));
                expect(")");
            }
            expect("->");
            f->result = parseType();
            f->body = block();
            p.push_back(std::move(f));
        }
        return p;
    }
};

// Stage 3. Name resolution assigns every declaration a unique frame slot.
struct Symbol {
    Type type;
    int slot;
    Symbol(Type t = TInt, int s = 0) : type(t), slot(s) {}
};
class Checker {
    Program &p;
    std::map<std::string, int> functions;
    std::vector<std::map<std::string, Symbol>> scopes;
    Function *current;
    Symbol lookup(const std::string &n, Pos pos) {
        for (std::size_t i = scopes.size(); i > 0; --i) {
            std::map<std::string, Symbol>::iterator it = scopes[i - 1].find(n);
            if (it != scopes[i - 1].end())
                return it->second;
        }
        fail(pos, "undefined variable '" + n + "'");
        return Symbol();
    }
    int declare(const std::string &n, Type t, Pos pos) {
        if (scopes.back().count(n))
            fail(pos, "duplicate variable '" + n + "' in this scope");
        int slot = current->locals++;
        scopes.back()[n] = Symbol(t, slot);
        return slot;
    }
    void need(Type actual, Type expected, Pos pos) {
        if (actual != expected)
            fail(pos, "expected " + typeName(expected) + ", got " + typeName(actual));
    }
    Type expr(Expr &e) {
        if (e.kind == Expr::Number)
            e.type = TInt;
        else if (e.kind == Expr::Boolean)
            e.type = TBool;
        else if (e.kind == Expr::Variable) {
            Symbol s = lookup(e.text, e.pos);
            e.type = s.type;
            e.index = s.slot;
        } else if (e.kind == Expr::Call) {
            if (!functions.count(e.text))
                fail(e.pos, "undefined function '" + e.text + "'");
            e.index = functions[e.text];
            Function &f = *p[e.index];
            if (e.args.size() != f.params.size())
                fail(e.pos, "wrong argument count for '" + e.text + "'");
            for (std::size_t i = 0; i < e.args.size(); ++i)
                need(expr(*e.args[i]), f.params[i].type, e.args[i]->pos);
            e.type = f.result;
        } else if (e.kind == Expr::Unary) {
            need(expr(*e.args[0]), e.text == "!" ? TBool : TInt, e.pos);
            e.type = e.text == "!" ? TBool : TInt;
        } else {
            Type a = expr(*e.args[0]), b = expr(*e.args[1]);
            if (e.text == "&&" || e.text == "||") {
                need(a, TBool, e.pos);
                need(b, TBool, e.pos);
                e.type = TBool;
            } else if (e.text == "==" || e.text == "!=") {
                need(b, a, e.pos);
                e.type = TBool;
            } else {
                need(a, TInt, e.pos);
                need(b, TInt, e.pos);
                e.type = (e.text == "<" || e.text == "<=" || e.text == ">" || e.text == ">=")
                             ? TBool
                             : TInt;
            }
        }
        return e.type;
    }
    bool stmt(Stmt &s, bool newScope = true) {
        if (s.kind == Stmt::Block) {
            if (newScope)
                scopes.push_back(std::map<std::string, Symbol>());
            bool returns = false;
            for (std::size_t i = 0; i < s.children.size(); ++i) {
                bool r = stmt(*s.children[i]);
                returns = returns || r;
            }
            if (newScope)
                scopes.pop_back();
            return returns;
        }
        Type t = expr(*s.expr);
        if (s.kind == Stmt::Let)
            s.slot = declare(s.name, t, s.pos);
        else if (s.kind == Stmt::Assign) {
            Symbol sym = lookup(s.name, s.pos);
            need(t, sym.type, s.pos);
            s.slot = sym.slot;
        } else if (s.kind == Stmt::Return) {
            need(t, current->result, s.pos);
            return true;
        } else if (s.kind == Stmt::If || s.kind == Stmt::While) {
            need(t, TBool, s.expr->pos);
            bool left = stmt(*s.children[0]);
            bool right = s.children.size() == 2 ? stmt(*s.children[1]) : false;
            return s.kind == Stmt::If && left && right;
        }
        return false;
    }

  public:
    explicit Checker(Program &program) : p(program), current(0) {}
    int check() {
        for (std::size_t i = 0; i < p.size(); ++i) {
            if (functions.count(p[i]->name))
                fail(p[i]->pos, "duplicate function '" + p[i]->name + "'");
            functions[p[i]->name] = static_cast<int>(i);
        }
        if (!functions.count("main"))
            fail(Pos(), "program requires fn main() -> int");
        int entry = functions["main"];
        if (!p[entry]->params.empty() || p[entry]->result != TInt)
            fail(p[entry]->pos, "main must have signature fn main() -> int");
        for (std::size_t i = 0; i < p.size(); ++i) {
            current = p[i].get();
            current->locals = 0;
            scopes.clear();
            scopes.push_back(std::map<std::string, Symbol>());
            for (std::size_t j = 0; j < current->params.size(); ++j)
                declare(current->params[j].name, current->params[j].type, current->params[j].pos);
            if (!stmt(*current->body, false))
                fail(current->pos, "function '" + current->name + "' may reach end without return");
        }
        return entry;
    }
};

// Stage 4. Jumps are patched after their target instruction becomes known.
struct Instruction {
    std::string op;
    std::int64_t arg;
    Pos pos;
    Instruction(std::string o, std::int64_t a, Pos p) : op(o), arg(a), pos(p) {}
};
typedef std::vector<Instruction> Code;
class Generator {
    Code *code;
    std::size_t emit(const std::string &op, std::int64_t arg, Pos p) {
        code->push_back(Instruction(op, arg, p));
        return code->size() - 1;
    }
    void patch(std::size_t i) { (*code)[i].arg = static_cast<std::int64_t>(code->size()); }
    void expr(const Expr &e) {
        if (e.kind == Expr::Number || e.kind == Expr::Boolean)
            emit("PUSH", e.value, e.pos);
        else if (e.kind == Expr::Variable)
            emit("LOAD", e.index, e.pos);
        else if (e.kind == Expr::Call) {
            for (std::size_t i = 0; i < e.args.size(); ++i)
                expr(*e.args[i]);
            emit("CALL", e.index, e.pos);
        } else if (e.kind == Expr::Unary) {
            expr(*e.args[0]);
            emit(e.text == "!" ? "NOT" : "NEG", 0, e.pos);
        } else if (e.text == "&&" || e.text == "||") {
            expr(*e.args[0]);
            std::size_t branch = emit("JZ", 0, e.pos);
            if (e.text == "&&")
                expr(*e.args[1]);
            else
                emit("PUSH", 1, e.pos);
            std::size_t end = emit("JMP", 0, e.pos);
            patch(branch);
            if (e.text == "&&")
                emit("PUSH", 0, e.pos);
            else
                expr(*e.args[1]);
            patch(end);
        } else {
            expr(*e.args[0]);
            expr(*e.args[1]);
            emit(e.text, 0, e.pos);
        }
    }
    void stmt(const Stmt &s) {
        if (s.kind == Stmt::Block) {
            for (std::size_t i = 0; i < s.children.size(); ++i)
                stmt(*s.children[i]);
            return;
        }
        if (s.kind == Stmt::While) {
            std::size_t head = code->size();
            expr(*s.expr);
            std::size_t end = emit("JZ", 0, s.pos);
            stmt(*s.children[0]);
            emit("JMP", static_cast<std::int64_t>(head), s.pos);
            patch(end);
            return;
        }
        expr(*s.expr);
        if (s.kind == Stmt::Let || s.kind == Stmt::Assign)
            emit("STORE", s.slot, s.pos);
        else if (s.kind == Stmt::Return)
            emit("RET", 0, s.pos);
        else if (s.kind == Stmt::Print)
            emit(s.expr->type == TBool ? "PRINT_BOOL" : "PRINT_INT", 0, s.pos);
        else if (s.kind == Stmt::Expression)
            emit("POP", 0, s.pos);
        else if (s.kind == Stmt::If) {
            std::size_t other = emit("JZ", 0, s.pos);
            stmt(*s.children[0]);
            std::size_t end = emit("JMP", 0, s.pos);
            patch(other);
            if (s.children.size() == 2)
                stmt(*s.children[1]);
            patch(end);
        }
    }

  public:
    std::vector<Code> generate(const Program &p) {
        std::vector<Code> out(p.size());
        for (std::size_t i = 0; i < p.size(); ++i) {
            code = &out[i];
            stmt(*p[i]->body);
        }
        return out;
    }
};

// Stage 5. Checked integer semantics: host C++ signed overflow is never used.
static std::int64_t checked(std::int64_t x, Pos p) {
    if (x < -2147483648LL || x > 2147483647LL)
        fail(p, "int32 overflow");
    return x;
}
static std::int64_t binary(const std::string &op, std::int64_t a, std::int64_t b, Pos p) {
    if (op == "+")
        return checked(a + b, p);
    if (op == "-")
        return checked(a - b, p);
    if (op == "*")
        return checked(a * b, p);
    if (op == "/" || op == "%") {
        if (b == 0)
            fail(p, "division by zero");
        return op == "/" ? checked(a / b, p) : checked(a % b, p);
    }
    if (op == "<")
        return a < b;
    if (op == "<=")
        return a <= b;
    if (op == ">")
        return a > b;
    if (op == ">=")
        return a >= b;
    if (op == "==")
        return a == b;
    if (op == "!=")
        return a != b;
    fail(p, "internal: unknown binary opcode");
    return 0;
}
class VM {
    const Program &p;
    const std::vector<Code> &codes;
    std::uint64_t steps;
    static std::int64_t pop(std::vector<std::int64_t> &stack, Pos pos) {
        if (stack.empty())
            fail(pos, "internal: operand stack underflow");
        std::int64_t x = stack.back();
        stack.pop_back();
        return x;
    }
    std::int64_t call(int id, const std::vector<std::int64_t> &args, int depth, Pos callPos) {
        if (depth > 256)
            fail(callPos, "call depth exceeds 256");
        const Function &f = *p[id];
        std::vector<std::int64_t> locals(static_cast<std::size_t>(f.locals), 0), stack;
        for (std::size_t i = 0; i < args.size(); ++i)
            locals[i] = args[i];
        const Code &code = codes[id];
        std::size_t ip = 0;
        while (ip < code.size()) {
            const Instruction &in = code[ip++];
            if (++steps > 1000000)
                fail(in.pos, "execution step limit exceeded (1000000)");
            const std::string &op = in.op;
            if (op == "PUSH")
                stack.push_back(in.arg);
            else if (op == "LOAD")
                stack.push_back(locals.at(static_cast<std::size_t>(in.arg)));
            else if (op == "STORE")
                locals.at(static_cast<std::size_t>(in.arg)) = pop(stack, in.pos);
            else if (op == "POP")
                pop(stack, in.pos);
            else if (op == "NEG")
                stack.push_back(checked(-pop(stack, in.pos), in.pos));
            else if (op == "NOT")
                stack.push_back(!pop(stack, in.pos));
            else if (op == "JMP")
                ip = static_cast<std::size_t>(in.arg);
            else if (op == "JZ") {
                if (!pop(stack, in.pos))
                    ip = static_cast<std::size_t>(in.arg);
            } else if (op == "CALL") {
                std::vector<std::int64_t> argv(
                    p.at(static_cast<std::size_t>(in.arg))->params.size());
                for (std::size_t i = argv.size(); i > 0; --i)
                    argv[i - 1] = pop(stack, in.pos);
                stack.push_back(call(static_cast<int>(in.arg), argv, depth + 1, in.pos));
            } else if (op == "RET")
                return pop(stack, in.pos);
            else if (op == "PRINT_INT")
                std::cout << pop(stack, in.pos) << '\n';
            else if (op == "PRINT_BOOL")
                std::cout << (pop(stack, in.pos) ? "true" : "false") << '\n';
            else {
                std::int64_t b = pop(stack, in.pos), a = pop(stack, in.pos);
                stack.push_back(binary(op, a, b, in.pos));
            }
        }
        fail(f.pos, "internal: function fell through");
        return 0;
    }

  public:
    VM(const Program &program, const std::vector<Code> &c) : p(program), codes(c), steps(0) {}
    void run(int entry) { call(entry, std::vector<std::int64_t>(), 1, p[entry]->pos); }
};

// Alternate backend. Expression temporaries preserve left-to-right evaluation,
// even though C++11 does not specify function argument evaluation order.
class CppEmitter {
    std::ostream &out;
    int serial, indent;
    const Program &p;
    static std::string cppType(Type t) { return t == TInt ? "std::int32_t" : "bool"; }
    static std::string str(std::int64_t n) {
        std::ostringstream s;
        s << n;
        return s.str();
    }
    static std::string loc(Pos p) { return str(p.line) + "," + str(p.col); }
    void line(const std::string &s) {
        out << std::string(static_cast<std::size_t>(indent) * 2, ' ') << s << '\n';
    }
    std::string expr(const Expr &e) {
        std::string name = "t" + str(serial++);
        if (e.kind == Expr::Number) {
            line("std::int32_t " + name + " = static_cast<std::int32_t>(" + str(e.value) + "LL);");
            return name;
        }
        if (e.kind == Expr::Boolean) {
            line("bool " + name + " = " + (e.value ? "true" : "false") + ";");
            return name;
        }
        if (e.kind == Expr::Variable) {
            line(cppType(e.type) + " " + name + " = v" + str(e.index) + ";");
            return name;
        }
        if (e.kind == Expr::Call) {
            std::string args;
            for (std::size_t i = 0; i < e.args.size(); ++i) {
                std::string a = expr(*e.args[i]);
                if (i)
                    args += ",";
                args += a;
            }
            line(cppType(e.type) + " " + name + " = f" + str(e.index) + "(" + args + ");");
            return name;
        }
        std::string a = expr(*e.args[0]);
        if (e.kind == Expr::Unary) {
            line(cppType(e.type) + " " + name + " = " +
                 (e.text == "!" ? "!" + a
                                : "ck(-static_cast<std::int64_t>(" + a + ")," + loc(e.pos) + ")") +
                 ";");
            return name;
        }
        if (e.text == "&&" || e.text == "||") {
            line("bool " + name + " = " + a + ";");
            line("if (" + (e.text == "&&" ? a : "!" + a) + ") {");
            ++indent;
            std::string b = expr(*e.args[1]);
            line(name + " = " + b + ";");
            --indent;
            line("}");
            return name;
        }
        std::string b = expr(*e.args[1]);
        if (e.text == "/" || e.text == "%")
            line("std::int32_t " + name + " = divrem(" + a + "," + b + "," +
                 (e.text == "%" ? "true" : "false") + "," + loc(e.pos) + ");");
        else if (e.type == TInt)
            line("std::int32_t " + name + " = ck(static_cast<std::int64_t>(" + a + ") " + e.text +
                 " " + b + "," + loc(e.pos) + ");");
        else
            line("bool " + name + " = " + a + " " + e.text + " " + b + ";");
        return name;
    }
    void stmt(const Stmt &s, bool braces = true) {
        if (s.kind == Stmt::Block) {
            if (braces) {
                line("{");
                ++indent;
            }
            for (std::size_t i = 0; i < s.children.size(); ++i)
                stmt(*s.children[i]);
            if (braces) {
                --indent;
                line("}");
            }
            return;
        }
        line("tick(" + loc(s.pos) + ");");
        if (s.kind == Stmt::While) {
            line("while (true) {");
            ++indent;
            line("tick(" + loc(s.pos) + ");");
            std::string c = expr(*s.expr);
            line("if (!" + c + ") break;");
            stmt(*s.children[0]);
            --indent;
            line("}");
            return;
        }
        std::string value = expr(*s.expr);
        if (s.kind == Stmt::Let)
            line(cppType(s.expr->type) + " v" + str(s.slot) + " = " + value + ";");
        else if (s.kind == Stmt::Assign)
            line("v" + str(s.slot) + " = " + value + ";");
        else if (s.kind == Stmt::Print)
            line("std::cout << " + value + " << '\\n';");
        else if (s.kind == Stmt::Return)
            line("return " + value + ";");
        else if (s.kind == Stmt::If) {
            line("if (" + value + ")");
            stmt(*s.children[0]);
            if (s.children.size() == 2) {
                line("else");
                stmt(*s.children[1]);
            }
        } else
            line("(void)" + value + ";");
    }
    std::string signature(std::size_t i) {
        const Function &f = *p[i];
        std::string s = cppType(f.result) + " f" + str(static_cast<std::int64_t>(i)) + "(";
        for (std::size_t j = 0; j < f.params.size(); ++j) {
            if (j)
                s += ",";
            s += cppType(f.params[j].type) + " v" + str(static_cast<std::int64_t>(j));
        }
        return s + ")";
    }

  public:
    CppEmitter(std::ostream &o, const Program &program)
        : out(o), serial(0), indent(0), p(program) {}
    void generate(int entry) {
        out << "// Generated by Sprout. Build: g++ -std=c++11 program.cpp -o program\n";
        out << R"CPP(#include <cstdint>
#include <iostream>
#include <sstream>
#include <stdexcept>
static std::uint64_t ticks=0; static int depth=0;
static void error(int l,int c,const char* m){std::ostringstream s;s<<l<<":"<<c<<": runtime error: "<<m;throw std::runtime_error(s.str());}
static void tick(int l,int c){if(++ticks>1000000)error(l,c,"execution step limit exceeded (1000000)");}
struct Guard{Guard(int l,int c){if(++depth>256)error(l,c,"call depth exceeds 256");}~Guard(){--depth;}};
static std::int32_t ck(std::int64_t n,int l,int c){if(n < -2147483648LL || n>2147483647LL)error(l,c,"int32 overflow");return static_cast<std::int32_t>(n);}
static std::int32_t divrem(std::int32_t a,std::int32_t b,bool rem,int l,int c){if(!b)error(l,c,"division by zero");return ck(rem?static_cast<std::int64_t>(a)%b:static_cast<std::int64_t>(a)/b,l,c);}
)CPP";
        for (std::size_t i = 0; i < p.size(); ++i)
            line(signature(i) + ";");
        for (std::size_t i = 0; i < p.size(); ++i) {
            line(signature(i) + " {");
            ++indent;
            line("Guard guard(" + loc(p[i]->pos) + ");");
            stmt(*p[i]->body, false);
            line("throw std::runtime_error(\"unreachable function end\");");
            --indent;
            line("}");
        }
        line("int main() { try { std::cout << std::boolalpha; f" + str(entry) +
             "(); return 0; } catch(const std::exception& e) { std::cerr << e.what() << '\\n'; "
             "return 1; } }");
    }
};

static void dumpExpr(const Expr &e, int depth) {
    std::cout << std::string(static_cast<std::size_t>(depth) * 2, ' ');
    if (e.kind == Expr::Number)
        std::cout << "number " << e.value;
    else if (e.kind == Expr::Boolean)
        std::cout << (e.value ? "true" : "false");
    else
        std::cout << e.text;
    std::cout << " : " << typeName(e.type) << "\n";
    for (std::size_t i = 0; i < e.args.size(); ++i)
        dumpExpr(*e.args[i], depth + 1);
}
static void dumpStmt(const Stmt &s, int depth) {
    static const char *names[] = {"block", "let",   "assign", "print",
                                  "if",    "while", "return", "expression"};
    std::cout << std::string(static_cast<std::size_t>(depth) * 2, ' ') << names[s.kind];
    if (!s.name.empty())
        std::cout << " " << s.name << " [slot " << s.slot << "]";
    std::cout << "\n";
    if (s.expr)
        dumpExpr(*s.expr, depth + 1);
    for (std::size_t i = 0; i < s.children.size(); ++i)
        dumpStmt(*s.children[i], depth + 1);
}
int main(int argc, char **argv) {
    std::string mode = "--run", path;
    if (argc == 2 && std::string(argv[1]) != "--help")
        path = argv[1];
    else if (argc == 3) {
        mode = argv[1];
        path = argv[2];
    } else {
        std::cout << "Sprout compiler (C++11 baseline)\nUsage: sprout "
                     "[--run|--tokens|--ast|--bytecode|--check|--emit-cpp] file.spr\n";
        return argc == 2 ? 0 : 2;
    }
    if (mode != "--run" && mode != "--tokens" && mode != "--ast" && mode != "--bytecode" &&
        mode != "--check" && mode != "--emit-cpp") {
        std::cerr << "unknown option: " << mode << "\n";
        return 2;
    }
    try {
        std::ifstream input(path.c_str(), std::ios::binary);
        if (!input) {
            std::cerr << "cannot open " << path << "\n";
            return 2;
        }
        std::ostringstream buffer;
        buffer << input.rdbuf();
        std::string source = buffer.str();
        if (source.size() > 1024 * 1024)
            fail(Pos(), "source exceeds 1 MiB limit");
        std::vector<Token> tokens = Lexer(source).scan();
        if (mode == "--tokens") {
            for (std::size_t i = 0; i < tokens.size(); ++i)
                std::cout << tokens[i].pos.line << ":" << tokens[i].pos.col << " " << tokens[i].kind
                          << " " << tokens[i].text << "\n";
            return 0;
        }
        Program program = Parser(tokens).parse();
        int entry = Checker(program).check();
        if (mode == "--check") {
            std::cout << "OK\n";
            return 0;
        }
        if (mode == "--ast") {
            for (std::size_t i = 0; i < program.size(); ++i) {
                std::cout << "fn " << program[i]->name << " -> " << typeName(program[i]->result)
                          << " [locals " << program[i]->locals << "]\n";
                dumpStmt(*program[i]->body, 1);
            }
            return 0;
        }
        if (mode == "--emit-cpp") {
            CppEmitter(std::cout, program).generate(entry);
            return 0;
        }
        std::vector<Code> codes = Generator().generate(program);
        if (mode == "--bytecode") {
            for (std::size_t i = 0; i < codes.size(); ++i) {
                std::cout << "fn " << i << " " << program[i]->name << " (params "
                          << program[i]->params.size() << ", locals " << program[i]->locals
                          << ")\n";
                for (std::size_t j = 0; j < codes[i].size(); ++j) {
                    const Instruction &in = codes[i][j];
                    std::cout << "  " << j << " " << in.op << " " << in.arg << " @" << in.pos.line
                              << ":" << in.pos.col << "\n";
                }
            }
            return 0;
        }
        VM(program, codes).run(entry);
        return 0;
    } catch (const Error &e) {
        std::cerr << path << ":" << e.pos.line << ":" << e.pos.col << ": error: " << e.what()
                  << "\n";
        return 1;
    } catch (const std::exception &e) {
        std::cerr << "compiler error: " << e.what() << "\n";
        return 1;
    }
}
