"""Behavioral compiler tests; --native CXX also checks the alternate backend.

Usage: python tests/run_tests.py build/sprout[.exe] [--native g++]
No third-party Python dependencies. A failing assertion exits nonzero.
"""
import argparse
import pathlib
import subprocess
import tempfile


def program(body):
    return "fn main() -> int { " + body + " return 0; }"


POSITIVE = [
    ("precedence", program("print(1 + 2 * 3); print((1+2)*3);"), "7\n9\n"),
    ("left_associative", program("print(20-5-2); print(20/2/2);"), "13\n5\n"),
    ("comparisons", program("print(2<3); print(3<=3); print(4>3); print(3>=4); print(2==2); print(2!=2);"), "true\ntrue\ntrue\nfalse\ntrue\nfalse\n"),
    ("booleans", program("print(!false); print(true == !false); print(true != false); print(false || true && false);"), "true\ntrue\ntrue\nfalse\n"),
    ("checked_boundaries", program("print(-2147483648); print(2147483647); print(-2147483648 % -1); print(-7/3); print(-7%3);"), "-2147483648\n2147483647\n0\n-2\n-1\n"),
    ("unary", program("let x = 5; print(-x); print(--x); print(- - 5);"), "-5\n5\n5\n"),
    ("shadow", program("let x=10; { let x=x+1; print(x); } print(x);"), "11\n10\n"),
    ("assign_outer", program("let x=1; { x=9; } print(x);"), "9\n"),
    ("loop_slots", program("let i=0; let sum=0; while(i<5){let n=i; sum=sum+n; i=i+1;} print(sum);"), "10\n"),
    ("if_else", program("if(false){print(1);}else{print(2);} if(true){print(3);}"), "2\n3\n"),
    ("short_circuit", program("print(false && (1/0 == 1)); print(true || (1/0 == 1));"), "false\ntrue\n"),
    ("comment_eof", program("print(4);") + "// end", "4\n"),
    ("forward_recursion", "fn main()->int {print(fib(10)); return 0;} fn fib(n:int)->int {if(n<2){return n;}return fib(n-1)+fib(n-2);}", "55\n"),
    ("bool_function", "fn even(n:int)->bool {if(n==0){return true;}return odd(n-1);} fn odd(n:int)->bool {if(n==0){return false;}return even(n-1);} fn main()->int {print(even(8));return 0;}", "true\n"),
    ("return_both", "fn choose(b:bool)->int {if(b){return 3;}else{return 4;}} fn main()->int {print(choose(false));return 0;}", "4\n"),
    ("evaluation_order", "fn mark(x:int)->int {print(x);return x;} fn add(a:int,b:int)->int{return a+b;} fn main()->int {print(add(mark(1),mark(2)));print(mark(3)+mark(4));return 0;}", "1\n2\n3\n3\n4\n7\n"),
    ("short_circuit_effects", "fn mark(x:int)->bool {print(x);return true;} fn main()->int {print(false&&mark(1));print(true||mark(2));print(true&&mark(3));print(false||mark(4));return 0;}", "false\ntrue\n3\ntrue\n4\ntrue\n"),
    ("discard_expression", program("1+2; print(8);"), "8\n"),
    ("return_early", "fn main()->int{print(1);return 0;print(99);}", "1\n"),
    ("main_result_ignored", "fn main()->int{return 27;}", ""),
]

NEGATIVE = [
    ("unknown_character", program("print(@);"), "unknown character"),
    ("single_amp", program("print(true & false);"), "unknown character"),
    ("missing_semicolon", program("print(1)"), "expected ';'"),
    ("missing_brace", "fn main()->int{ return 0;", "expected '}'"),
    ("missing_expr", program("print();"), "expected expression"),
    ("literal_too_large", program("print(2147483648);"), "literal"),
    ("literal_too_small", program("print(-2147483649);"), "literal"),
    ("huge_literal", program("print(99999999999999999999999999999999999999);"), "literal"),
    ("undefined", program("print(x);"), "undefined variable"),
    ("self_reference", program("let x=x;"), "undefined variable"),
    ("out_of_scope", program("{let x=1;} print(x);"), "undefined variable"),
    ("duplicate_local", program("let x=1;let x=2;"), "duplicate variable"),
    ("duplicate_parameter", "fn f(x:int,x:int)->int{return x;}"+program(""), "duplicate variable"),
    ("param_local_duplicate", "fn f(x:int)->int{let x=2;return x;}"+program(""), "duplicate variable"),
    ("duplicate_function", program("")+program(""), "duplicate function"),
    ("missing_main", "fn f()->int{return 0;}", "requires fn main"),
    ("main_param", "fn main(x:int)->int{return x;}", "main must"),
    ("main_bool", "fn main()->bool{return true;}", "main must"),
    ("undefined_function", program("foo();"), "undefined function"),
    ("argument_count", "fn f(x:int)->int{return x;}"+program("f();"), "argument count"),
    ("argument_type", "fn f(x:int)->int{return x;}"+program("f(true);"), "expected int"),
    ("return_type", "fn main()->int{return true;}", "expected int"),
    ("return_missing", "fn main()->int{print(1);}", "without return"),
    ("return_conditional", "fn main()->int{if(true){return 0;}}", "without return"),
    ("return_loop_conservative", "fn main()->int{while(true){return 0;}}", "without return"),
    ("type_assignment", program("let x=1;x=true;"), "expected int"),
    ("type_condition", program("if(1){print(1);}"), "expected bool"),
    ("type_arithmetic", program("print(true+1);"), "expected int"),
    ("type_equality", program("print(1==true);"), "expected int"),
    ("type_logical", program("print(1&&true);"), "expected bool"),
    ("static_error_in_skipped_rhs", program("print(false&&(undefined==1));"), "undefined variable"),
    ("long_expression_guard", program("print(" + "+".join(["1"] * 200) + ");"), "tree depth"),
    ("nested_syntax_guard", program("print(" + "(" * 300 + "1" + ")" * 300 + ");"), "syntax nesting"),
    ("source_size_guard", " " * (1024 * 1024 + 1), "1 MiB"),
]

RUNTIME = [
    ("add_overflow", program("print(2147483647+1);"), "overflow"),
    ("sub_overflow", program("print(-2147483648-1);"), "overflow"),
    ("multiply_overflow", program("print(2147483647*2147483647);"), "overflow"),
    ("negate_overflow", program("let x=-2147483648;print(-x);"), "overflow"),
    ("division_overflow", program("print(-2147483648/-1);"), "overflow"),
    ("division_zero", program("print(7/0);"), "division by zero"),
    ("modulo_zero", program("print(7%0);"), "division by zero"),
    ("step_limit", program("while(true){}"), "step limit"),
    ("depth_limit", "fn f()->int{return f();}"+program("f();"), "call depth"),
]


def run(command):
    return subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=30)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("compiler", type=pathlib.Path)
    parser.add_argument("--native", metavar="CXX")
    args = parser.parse_args()
    compiler = str(args.compiler.resolve())
    count = 0
    test_root = pathlib.Path(__file__).resolve().parents[1] / "build" / "test-runs"
    test_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="sprout-tests-", dir=test_root) as temp:
        folder = pathlib.Path(temp)
        path = folder / "test.spr"
        for name, source, expected in POSITIVE:
            path.write_text(source, encoding="utf-8")
            result = run([compiler, str(path)])
            assert result.returncode == 0, (name, result.stderr)
            assert result.stdout == expected, (name, result.stdout, expected)
            count += 1
        for name, source, expected in NEGATIVE:
            path.write_text(source, encoding="utf-8")
            result = run([compiler, "--check", str(path)])
            assert result.returncode == 1, (name, result.returncode, result.stderr)
            assert expected in result.stderr, (name, result.stderr, expected)
            assert ": error:" in result.stderr, (name, "missing source position")
            count += 1
        for name, source, expected in RUNTIME:
            path.write_text(source, encoding="utf-8")
            checked = run([compiler, "--check", str(path)])
            assert checked.returncode == 0, (name, checked.stderr)
            result = run([compiler, str(path)])
            assert result.returncode == 1 and expected in result.stderr, (name, result.stderr)
            count += 1
        path.write_text(program("let x=2;print(x+3);"), encoding="utf-8")
        for mode, needle in [("--tokens", "let"), ("--ast", "slot 0"), ("--bytecode", "STORE"), ("--check", "OK")]:
            result = run([compiler, mode, str(path)])
            assert result.returncode == 0 and needle in result.stdout, (mode, result)
            count += 1
        if args.native:
            # One combined positive program exercises all successful paths in one build.
            combined = []
            expected_output = ""
            for index, (_, source, expected) in enumerate(POSITIVE):
                # Rename all functions to avoid duplicate declarations across cases.
                import re
                names = re.findall(r"\bfn\s+([A-Za-z_]\w*)", source)
                # Do not use callbacks that substitute the same name twice.
                mapping = {n: "case"+str(index)+"_"+n for n in names}
                source = re.sub(r"\b[A-Za-z_]\w*\b", lambda m: mapping.get(m[0], m[0]), source)
                combined.append(source)
                expected_output += expected
            combined.append("fn main()->int{"+"".join("case"+str(i)+"_main();" for i in range(len(POSITIVE)))+"return 0;}")
            path.write_text("\n".join(combined), encoding="utf-8")
            generated = run([compiler, "--emit-cpp", str(path)])
            assert generated.returncode == 0, generated.stderr
            cpp = folder / "generated.cpp"
            cpp.write_text(generated.stdout, encoding="utf-8")
            exe = folder / "generated.exe"
            for standard in ("c++11", "c++14", "c++17", "c++20"):
                built = run([args.native, "-std="+standard, str(cpp), "-o", str(exe)])
                assert built.returncode == 0, (standard, built.stderr)
                result = run([str(exe)])
                assert result.returncode == 0 and result.stdout == expected_output, (standard, result.stdout, result.stderr)
                count += 1
            # All runtime traps must also be preserved by the C++ backend.
            for name, source, expected in RUNTIME:
                path.write_text(source, encoding="utf-8")
                generated = run([compiler, "--emit-cpp", str(path)])
                assert generated.returncode == 0, (name, generated.stderr)
                cpp.write_text(generated.stdout, encoding="utf-8")
                built = run([args.native, "-std=c++11", str(cpp), "-o", str(exe)])
                assert built.returncode == 0, (name, built.stderr)
                result = run([str(exe)])
                assert result.returncode == 1 and expected in result.stderr, (name, result.stderr)
                count += 1
    print("PASS:", count, "behavioral checks" + (" (including native C++11/14/17/20 output)" if args.native else ""))


if __name__ == "__main__":
    main()
