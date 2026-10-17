package com.kpitracking.service.approvalform;

import java.util.*;
import java.util.function.Function;

/**
 * Công thức của widget Công thức — thuần logic, cùng ngữ pháp với {@code model/formula.ts} phía giao diện.
 *
 * <pre>
 * biểu thức := hạng (('+' | '-') hạng)*
 * hạng      := thừa số (('*' | '/') thừa số)*
 * thừa số   := số | '{' id '}' | 'SUM' '(' '{' bảng '.' cột '}' ')' | '(' biểu thức ')' | '-' thừa số
 * </pre>
 *
 * Widget trống / bị ẩn tính là 0 (như Lark). Chia cho 0 ⇒ kết quả rỗng ({@code null}).
 */
public final class Formula {

    /** Một chỗ tham chiếu: {@code {id}} ({@code column == null}) hoặc {@code SUM({table.column})}. */
    public record Ref(String widget, String column) {
        public boolean sum() {
            return column != null;
        }
    }

    public static final class FormulaException extends RuntimeException {
        FormulaException(String message) {
            super(message);
        }
    }

    private sealed interface Node permits Num, RefNode, Neg, Bin {}

    private record Num(double value) implements Node {}

    private record RefNode(Ref ref) implements Node {}

    private record Neg(Node inner) implements Node {}

    private record Bin(char op, Node left, Node right) implements Node {}

    private final Node root;
    private final List<Ref> refs;

    private Formula(Node root, List<Ref> refs) {
        this.root = root;
        this.refs = List.copyOf(refs);
    }

    /** @throws FormulaException biểu thức sai cú pháp hoặc rỗng */
    public static Formula parse(String expression) {
        if (expression == null || expression.isBlank()) throw new FormulaException("empty");
        Parser p = new Parser(expression);
        Node root = p.expr();
        p.skipSpaces();
        if (!p.done()) throw new FormulaException("unexpected '" + p.peek() + "'");
        return new Formula(root, p.refs);
    }

    /** Mọi chỗ tham chiếu theo thứ tự xuất hiện. */
    public List<Ref> refs() {
        return refs;
    }

    /** @param values giá trị từng tham chiếu; {@code null} = 0 */
    public Double evaluate(Function<Ref, Double> values) {
        double v = eval(root, values);
        return Double.isFinite(v) ? v : null;
    }

    private static double eval(Node n, Function<Ref, Double> values) {
        if (n instanceof Num num) return num.value();
        if (n instanceof RefNode r) {
            Double v = values.apply(r.ref());
            return v == null ? 0d : v;
        }
        if (n instanceof Neg neg) return -eval(neg.inner(), values);
        Bin b = (Bin) n;
        double l = eval(b.left(), values);
        double r = eval(b.right(), values);
        return switch (b.op()) {
            case '+' -> l + r;
            case '-' -> l - r;
            case '*' -> l * r;
            default -> r == 0d ? Double.NaN : l / r;
        };
    }

    private static final class Parser {
        private final String s;
        private int i;
        private final List<Ref> refs = new ArrayList<>();

        Parser(String s) {
            this.s = s;
        }

        Node expr() {
            Node left = term();
            while (true) {
                skipSpaces();
                if (accept('+')) left = new Bin('+', left, term());
                else if (accept('-')) left = new Bin('-', left, term());
                else return left;
            }
        }

        Node term() {
            Node left = factor();
            while (true) {
                skipSpaces();
                if (accept('*')) left = new Bin('*', left, factor());
                else if (accept('/')) left = new Bin('/', left, factor());
                else return left;
            }
        }

        Node factor() {
            skipSpaces();
            if (done()) throw new FormulaException("unexpected end");
            char c = peek();
            if (accept('-')) return new Neg(factor());
            if (accept('(')) {
                Node inner = expr();
                skipSpaces();
                expect(')');
                return inner;
            }
            if (c == '{') {
                Ref ref = ref();
                if (ref.sum()) throw new FormulaException("column reference outside SUM");
                return new RefNode(ref);
            }
            if (s.startsWith("SUM", i)) {
                i += 3;
                skipSpaces();
                expect('(');
                skipSpaces();
                Ref ref = ref();
                if (!ref.sum()) throw new FormulaException("SUM needs {table.column}");
                skipSpaces();
                expect(')');
                return new RefNode(ref);
            }
            if (Character.isDigit(c) || c == '.') return number();
            throw new FormulaException("unexpected '" + c + "'");
        }

        Ref ref() {
            expect('{');
            int close = s.indexOf('}', i);
            if (close < 0) throw new FormulaException("missing '}'");
            String body = s.substring(i, close).trim();
            i = close + 1;
            if (body.isEmpty()) throw new FormulaException("empty reference");
            int dot = body.indexOf('.');
            Ref ref = dot < 0 ? new Ref(body, null) : new Ref(body.substring(0, dot), body.substring(dot + 1));
            if (ref.widget().isEmpty() || (ref.column() != null && ref.column().isEmpty())) {
                throw new FormulaException("bad reference");
            }
            refs.add(ref);
            return ref;
        }

        Node number() {
            int start = i;
            while (!done() && (Character.isDigit(peek()) || peek() == '.')) i++;
            try {
                return new Num(Double.parseDouble(s.substring(start, i)));
            } catch (NumberFormatException e) {
                throw new FormulaException("bad number");
            }
        }

        void expect(char c) {
            if (!accept(c)) throw new FormulaException("expected '" + c + "'");
        }

        boolean accept(char c) {
            if (!done() && s.charAt(i) == c) {
                i++;
                return true;
            }
            return false;
        }

        void skipSpaces() {
            while (!done() && Character.isWhitespace(s.charAt(i))) i++;
        }

        boolean done() {
            return i >= s.length();
        }

        char peek() {
            return s.charAt(i);
        }
    }
}
