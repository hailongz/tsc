"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ts = __importStar(require("typescript"));
const Compiler_1 = require("./Compiler");
function expressionCompile(out, e, program, options, isa) {
    let checker = program.getTypeChecker();
    if (ts.isPropertyAccessExpression(e)) {
        let name = checker.getSymbolAtLocation(e.name);
        if (e.expression.kind == ts.SyntaxKind.ThisKeyword && isa !== undefined) {
            var property;
            ts.forEachChild(isa, (node) => {
                if (ts.isPropertyDeclaration(node)) {
                    let n = checker.getSymbolAtLocation(node.name);
                    if (n.name == name.name) {
                        property = node;
                    }
                }
            });
            if (property !== undefined) {
                let type = checker.getTypeAtLocation(property.type);
                if (Compiler_1.isPublicProperty(property)) {
                    out.push("this->");
                    let name = checker.getSymbolAtLocation(e.name);
                    out.push("_");
                    out.push(name.name);
                }
                else {
                    out.push("this->");
                    let name = checker.getSymbolAtLocation(e.name);
                    out.push(name.name);
                }
                if ((type.flags & ts.TypeFlags.Object) != 0) {
                    out.push(".get()");
                }
            }
            else {
                out.push("this->");
                out.push(name.name);
                out.push("()");
            }
        }
        else {
            expressionCompile(out, e.expression, program, options, isa);
            out.push("->");
            out.push(name.name);
            out.push("()");
        }
    }
    else if (ts.isBinaryExpression(e)) {
        expressionCompile(out, e.left, program, options, isa);
        out.push(e.operatorToken.getText());
        expressionCompile(out, e.right, program, options, isa);
    }
    else if (ts.isIdentifier(e)) {
        if (e.text == "undefined" || e.text == "null") {
            out.push("nullptr");
        }
        else {
            out.push(e.text);
        }
    }
    else if (ts.isCallExpression(e)) {
        if (ts.isPropertyAccessExpression(e.expression)) {
            let name = checker.getSymbolAtLocation(e.expression.name);
            expressionCompile(out, e.expression.expression, program, options, isa);
            out.push("->");
            out.push(name.name);
            out.push("(");
            var vs = [];
            for (let arg of e.arguments) {
                expressionCompile(vs, arg, program, options, isa);
            }
            out.push(vs.join(","));
            out.push(")");
        }
        else {
            out.push("((" + options.kk + "::Any (*)(");
            {
                var vs = [];
                for (let arg of e.arguments) {
                    vs.push(options.kk + "::Any");
                }
                out.push(vs.join(","));
            }
            out.push("))(" + options.kk + "::IMP)");
            expressionCompile(out, e.expression, program, options, isa);
            out.push(")(");
            var vs = [];
            for (let arg of e.arguments) {
                expressionCompile(vs, arg, program, options, isa);
            }
            out.push(vs.join(","));
            out.push(")");
        }
    }
    else if (ts.isNewExpression(e)) {
        out.push("new ");
        expressionCompile(out, e.expression, program, options, isa);
        out.push("(");
        var vs = [];
        if (e.arguments != undefined) {
            for (let arg of e.arguments) {
                expressionCompile(vs, arg, program, options, isa);
            }
        }
        out.push(vs.join(","));
        out.push(")");
    }
    else if (ts.isNumericLiteral(e)) {
        out.push(e.getText());
    }
    else if (ts.isStringLiteral(e)) {
        out.push(JSON.stringify(e.text));
    }
    else {
        out.push(e.getText());
        console.info("[EX]", e.kind, e.getText());
    }
}
exports.expressionCompile = expressionCompile;
function statementCompile(out, st, program, options, level, isa) {
    let checker = program.getTypeChecker();
    if (ts.isReturnStatement(st)) {
        out.push("\t".repeat(level));
        out.push("return ");
        if (st.expression !== undefined) {
            expressionCompile(out, st.expression, program, options, isa);
        }
        out.push(";\n");
    }
    else if (ts.isIfStatement(st)) {
        out.push("\t".repeat(level));
        out.push("if(");
        expressionCompile(out, st.expression, program, options, isa);
        out.push(") {\n");
        statementCompile(out, st.thenStatement, program, options, level + 1, isa);
        if (st.elseStatement !== undefined) {
            out.push("\t".repeat(level));
            out.push("} else {\n");
            statementCompile(out, st.elseStatement, program, options, level + 1, isa);
        }
        out.push("\t".repeat(level));
        out.push("}\n");
    }
    else if (ts.isBlock(st)) {
        for (let v of st.statements) {
            statementCompile(out, v, program, options, level, isa);
        }
    }
    else if (ts.isExpressionStatement(st)) {
        out.push("\t".repeat(level));
        expressionCompile(out, st.expression, program, options, isa);
        out.push(";\n");
    }
    else if (ts.isVariableStatement(st)) {
        for (let v of st.declarationList.declarations) {
            out.push("\t".repeat(level));
            if (v.type === undefined) {
                out.push(options.kk + "::Any");
            }
            else {
                out.push(Compiler_1.getType(checker.getTypeAtLocation(v.type), options));
            }
            let n = checker.getSymbolAtLocation(v.name);
            out.push(" ");
            out.push(n.name);
            if (v.initializer !== undefined) {
                out.push(" = ");
                expressionCompile(out, v.initializer, program, options, isa);
            }
            out.push(";\n");
        }
    }
    else {
        console.info("[ST]", st.kind, st.getText());
    }
}
function bodyCompile(out, body, program, options, level, isa) {
    for (let st of body.statements) {
        statementCompile(out, st, program, options, level, isa);
    }
}
exports.bodyCompile = bodyCompile;
//# sourceMappingURL=BodyCompiler.js.map