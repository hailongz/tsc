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
var CC;
(function (CC) {
    function isPublicProperty(node) {
        if (node.modifiers !== undefined) {
            for (let m of node.modifiers) {
                if (m.kind == ts.SyntaxKind.PrivateKeyword || m.kind == ts.SyntaxKind.ProtectedKeyword) {
                    return false;
                }
            }
        }
        return true;
    }
    function isFunctionType(type) {
        if ((type.flags & ts.TypeFlags.Union) != 0) {
            type = type.getNonNullableType();
        }
        if ((type.flags & ts.TypeFlags.Object) != 0 && !type.isClassOrInterface()) {
            let t = type;
            return t.typeArguments === undefined;
        }
        return false;
    }
    function isObjectReferenceType(type) {
        if ((type.flags & ts.TypeFlags.Union) != 0) {
            type = type.getNonNullableType();
        }
        if ((type.flags & ts.TypeFlags.Object) != 0 && !type.isClassOrInterface()) {
            let t = type;
            return t.typeArguments !== undefined;
        }
        return false;
    }
    function isObjectType(type) {
        if ((type.flags & ts.TypeFlags.Union) != 0) {
            type = type.getNonNullableType();
        }
        if ((type.flags & ts.TypeFlags.Object) != 0) {
            if (type.isClassOrInterface()) {
                return true;
            }
            let t = type;
            return t.typeArguments !== undefined;
        }
        return false;
    }
    function isObjectWeakType(type) {
        if (isObjectType(type)) {
            if ((type.flags & ts.TypeFlags.Union) != 0) {
                for (let t of type.types) {
                    if (t.name !== undefined &&
                        (t.name == "weak") || t.name.endsWith(".weak")) {
                        return true;
                    }
                }
            }
            return false;
        }
        return false;
    }
    function getTypeAtLocation(node, checker) {
        if (node === undefined) {
            return undefined;
        }
        let type = checker.getTypeAtLocation(node);
        if (type === undefined) {
            return undefined;
        }
        type.name = node.getText();
        if (type.types !== undefined) {
            var i = 0;
            ts.forEachChild(node, (node) => {
                if (ts.isTypeNode(node)) {
                    let type = checker.getTypeAtLocation(node);
                    type.name = node.getText();
                }
            });
        }
        return type;
    }
    function getSymbolString(symbol, options) {
        let vs = [];
        var s = symbol;
        while (s !== undefined && (s.valueDeclaration === undefined || !ts.isSourceFile(s.valueDeclaration))) {
            vs.push(s.name);
            s = s.parent;
        }
        return vs.reverse().join("::");
    }
    function getType(type, options) {
        if (type === undefined) {
            return options.lib + "::Any";
        }
        if ((type.flags & ts.TypeFlags.Boolean) != 0) {
            return options.lib + "::Boolean";
        }
        while ((type.flags & ts.TypeFlags.Union) != 0) {
            let v = type.getNonNullableType();
            if (v == type) {
                type = v.types[0];
            }
            else {
                type = v;
            }
        }
        if ((type.flags & ts.TypeFlags.String) != 0) {
            return options.lib + "::String";
        }
        if ((type.flags & ts.TypeFlags.Number) != 0) {
            let t = type;
            if (t.name !== undefined) {
                let n = t.name.split(".");
                switch (n[n.length - 1]) {
                    case "int":
                        return options.lib + "::Int";
                    case "uint":
                        return options.lib + "::Uint";
                    case "int32":
                        return options.lib + "::Int32";
                    case "uint32":
                        return options.lib + "::Uint32";
                    case "int64":
                        return options.lib + "::Int64";
                    case "uint64":
                        return options.lib + "::Uint64";
                }
            }
            return options.lib + "::Number";
        }
        if ((type.flags & ts.TypeFlags.Object) != 0) {
            return getSymbolString(type.symbol, options) + " *";
        }
        if ((type.flags & ts.TypeFlags.Void) != 0) {
            return "void";
        }
        if ((type.flags & ts.TypeFlags.Any) != 0) {
            return options.lib + "::Any";
        }
        throw new Error("[TYPE] " + type.flags.toString());
    }
    function getDefaultValue(type, options) {
        if (type === undefined) {
            return "nullptr";
        }
        if ((type.flags & ts.TypeFlags.Union) != 0) {
            type = type.getNonNullableType();
        }
        if ((type.flags & ts.TypeFlags.String) != 0) {
            return '""';
        }
        if ((type.flags & ts.TypeFlags.Number) != 0) {
            return "0";
        }
        if ((type.flags & ts.TypeFlags.Boolean) != 0) {
            return "false";
        }
        return "nullptr";
    }
    function define(name, type, program, options) {
        if (type !== undefined && isFunctionType(type)) {
            let checker = program.getTypeChecker();
            let vs = [];
            if ((type.flags & ts.TypeFlags.Union) != 0) {
                type = type.getNonNullableType();
            }
            for (let sign of type.getCallSignatures()) {
                vs.push(options.lib);
                vs.push("::Closure<");
                let args = [];
                args.push(define("", sign.getReturnType(), program, options));
                for (let param of sign.parameters) {
                    if (ts.isParameter(param.valueDeclaration)) {
                        let vType = getTypeAtLocation(param.valueDeclaration.type, checker);
                        args.push(define("", vType, program, options));
                    }
                }
                vs.push(args.join(","));
                vs.push("> *");
                if (name != "") {
                    vs.push(" ");
                    vs.push(name);
                }
                break;
            }
            return vs.join('');
        }
        else if (type !== undefined && isObjectReferenceType(type)) {
            let vs = [];
            let t = type;
            if (t.typeArguments !== undefined) {
                for (let v of t.typeArguments) {
                    vs.push(define("", v, program, options));
                }
            }
            var s = getSymbolString(type.symbol, options);
            if (type.symbol.name == "map") {
                s = options.lib + "::Map";
            }
            else if (type.symbol.name == "array") {
                s = options.lib + "::Array";
            }
            s = s + "<" + vs.join(",") + ">";
            if (name != "") {
                s += " &" + name;
            }
            return s;
        }
        else {
            let s = getType(type, options);
            if (name != "") {
                s += " " + name;
            }
            return s;
        }
    }
    function getter(name, type, program, options) {
        let out = [];
        let v = define(name, type, program, options);
        if (v.trim() == "") {
            console.info("");
        }
        out.push(define(name, type, program, options));
        out.push("()");
        return out.join('');
    }
    function setter(name, value, type, program, options) {
        let out = [];
        out.push("void ");
        out.push(name);
        out.push("(");
        out.push(define(value, type, program, options));
        out.push(")");
        return out.join('');
    }
    function getSetSymbol(name) {
        return "set" + name.substr(0, 1).toLocaleUpperCase() + name.substr(1);
    }
    let FileType;
    (function (FileType) {
        FileType[FileType["Header"] = 0] = "Header";
        FileType[FileType["Source"] = 1] = "Source";
    })(FileType = CC.FileType || (CC.FileType = {}));
    class Compiler {
        constructor(options, out) {
            this._level = 0;
            this._isNewLine = true;
            this._options = options;
            this._out = out;
        }
        get isNewLine() {
            return this._isNewLine;
        }
        out(text) {
            this._out(text);
            this._isNewLine = text.endsWith("\n");
        }
        level(level = 0) {
            this.out("\t".repeat(Math.max(this._level + level, 0)));
        }
        include(name, isLibrary = false) {
            this.out("#include ");
            if (isLibrary) {
                this.out("<");
            }
            else {
                this.out('"');
            }
            this.out(name);
            if (isLibrary) {
                this.out(">\n");
            }
            else {
                this.out('"\n');
            }
        }
        includeFile(file, program) {
            let names = {};
            let ns = undefined;
            let checker = program.getTypeChecker();
            let v = this;
            function heritageClauses(clauses) {
                for (let clause of clauses) {
                    for (let type of clause.types) {
                        var name = type.expression.getText();
                        if (names[name] === undefined) {
                            if (ns === undefined) {
                                v.include(name + ".h", false);
                            }
                            else {
                                v.include(ns + "/" + name + ".h", true);
                            }
                            names[name] = true;
                        }
                    }
                }
            }
            function each(node) {
                if (ts.isModuleDeclaration(node)) {
                    let n = checker.getSymbolAtLocation(node.name);
                    ns = n.name;
                    if (node.body !== undefined) {
                        ts.forEachChild(node.body, each);
                    }
                    ns = undefined;
                }
                else if (ts.isInterfaceDeclaration(node)) {
                    let n = checker.getSymbolAtLocation(node.name);
                    names[n.name] = true;
                    if (node.heritageClauses !== undefined) {
                        heritageClauses(node.heritageClauses);
                    }
                }
                else if (ts.isClassDeclaration(node) && node.name !== undefined) {
                    let n = checker.getSymbolAtLocation(node.name);
                    names[n.name] = true;
                    if (node.heritageClauses !== undefined) {
                        heritageClauses(node.heritageClauses);
                    }
                }
            }
            ts.forEachChild(file, each);
        }
        namespaceStart(name) {
            this.level();
            this.out("namespace ");
            this.out(name);
            this.out(" {\n\n");
            this._level++;
        }
        namespaceEnd() {
            this._level--;
            this.level();
            this.out("}\n\n");
        }
        heritageClauses(clauses, isClass = true) {
            if (clauses !== undefined) {
                var superClass;
                for (let extend of clauses) {
                    if (extend.token == ts.SyntaxKind.ExtendsKeyword) {
                        superClass = extend;
                        break;
                    }
                }
                var s = ":";
                if (superClass !== undefined) {
                    for (let type of superClass.types) {
                        this.out(s);
                        this.out("public ");
                        this.out(type.expression.getText());
                        s = ",";
                    }
                }
                else {
                    this.out(s);
                    this.out("public ");
                    this.out(this._options.lib);
                    if (isClass) {
                        this.out("::Object");
                    }
                    s = ",";
                }
                for (let extend of clauses) {
                    if (superClass == extend) {
                        continue;
                    }
                    for (let type of extend.types) {
                        this.out(s);
                        this.out("public ");
                        this.out(type.expression.getText());
                        s = ",";
                    }
                }
            }
            else {
                if (isClass) {
                    this.out(":public " + this._options.lib);
                    this.out("::Object");
                }
            }
        }
        classStart(node, program) {
            let checker = program.getTypeChecker();
            if (node.name !== undefined) {
                let name = checker.getSymbolAtLocation(node.name);
                this.level();
                this.out("class ");
                this.out(name.name);
                this.heritageClauses(node.heritageClauses, true);
                this.out(" {\n");
                this._level++;
                console.info("[class]", name.name, ">>");
            }
        }
        classEnd() {
            console.info("[class] <<");
            this._level--;
            this.level();
            this.out("};\n\n");
        }
        classGetter(s, program, mod = false) {
            let checker = program.getTypeChecker();
            let name = checker.getSymbolAtLocation(s.name);
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            if (mod === true) {
                var m = "public: ";
                if (s.modifiers !== undefined) {
                    for (let element of s.modifiers) {
                        if (element.kind == ts.SyntaxKind.PrivateKeyword) {
                            m = "private: ";
                        }
                        else if (element.kind == ts.SyntaxKind.ProtectedKeyword) {
                            m = "protected: ";
                        }
                    }
                }
                this.level(-1);
                this.out(m);
                this.out("\n");
            }
            this.level();
            this.out("virtual ");
            this.out(getter(name.name, type, program, this._options));
            this.out(";\n");
        }
        classSetter(s, program, mod = false) {
            let checker = program.getTypeChecker();
            let name = checker.getSymbolAtLocation(s.name);
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            if (mod === true) {
                var m = "public: ";
                if (s.modifiers !== undefined) {
                    for (let element of s.modifiers) {
                        if (element.kind == ts.SyntaxKind.PrivateKeyword) {
                            m = "private: ";
                        }
                        else if (element.kind == ts.SyntaxKind.ProtectedKeyword) {
                            m = "protected: ";
                        }
                    }
                }
                this.level(-1);
                this.out(m);
                this.out("\n");
            }
            this.level();
            this.out("virtual ");
            this.out(setter(getSetSymbol(name.name), "v", type, program, this._options));
            this.out(";\n");
        }
        classMember(s, program, prefix = "_") {
            let checker = program.getTypeChecker();
            let name = checker.getSymbolAtLocation(s.name);
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            this.level();
            if (type !== undefined && isObjectReferenceType(type)) {
                this.out(define("", type, program, this._options));
                this.out(" " + prefix + name.name);
            }
            else if (type !== undefined && (isObjectType(type) || isFunctionType(type))) {
                this.out(this._options.lib);
                if (isObjectWeakType(type)) {
                    this.out("::Weak<");
                }
                else {
                    this.out("::Strong<");
                }
                this.out(define("", type, program, this._options));
                this.out("> ");
                this.out(prefix);
                this.out(name.name);
            }
            else {
                this.out(define(prefix + name.name, type, program, this._options));
            }
            this.out(";\n");
        }
        classProperty(s, program) {
            let checker = program.getTypeChecker();
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            let name = checker.getSymbolAtLocation(s.name);
            var mod = "public: ";
            var st = false;
            var readonly = false;
            if (s.modifiers !== undefined) {
                for (let element of s.modifiers) {
                    if (element.kind == ts.SyntaxKind.ReadonlyKeyword) {
                        readonly = true;
                    }
                    else if (element.kind == ts.SyntaxKind.PrivateKeyword) {
                        mod = "private: ";
                    }
                    else if (element.kind == ts.SyntaxKind.ProtectedKeyword) {
                        mod = "protected: ";
                    }
                    else if (element.kind == ts.SyntaxKind.StaticKeyword) {
                        st = true;
                    }
                }
            }
            if (mod != "public: ") {
                this.level(-1);
                this.out(mod);
                this.out("\n");
                this.classMember(s, program, "");
            }
            else {
                this.level(-1);
                this.out(mod);
                this.out("\n");
                this.classGetter(s, program);
                if (!readonly) {
                    this.classSetter(s, program);
                }
                this.level(-1);
                this.out("protected:\n");
                this.classMember(s, program, "_");
            }
            this.out("\n");
        }
        classPropertys(s, program) {
            let v = this;
            ts.forEachChild(s, (node) => {
                if (ts.isPropertyDeclaration(node)) {
                    v.classProperty(node, program);
                }
                else if (ts.isGetAccessorDeclaration(node)) {
                    v.classGetter(node, program, true);
                }
                else if (ts.isSetAccessorDeclaration(node)) {
                    v.classSetter(node, program, true);
                }
            });
        }
        classMethod(s, program) {
            let checker = program.getTypeChecker();
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            let symbol = checker.getSymbolAtLocation(s.name);
            var mod = "public: ";
            var st = false;
            var readonly = false;
            if (s.modifiers !== undefined) {
                for (let element of s.modifiers) {
                    if (element.kind == ts.SyntaxKind.PrivateKeyword) {
                        mod = "private: ";
                    }
                    else if (element.kind == ts.SyntaxKind.ProtectedKeyword) {
                        mod = "protected: ";
                    }
                    else if (element.kind == ts.SyntaxKind.StaticKeyword) {
                        st = true;
                    }
                }
            }
            this.level(-1);
            this.out(mod);
            this.out("\n");
            this.level();
            if (st) {
                this.out("static ");
            }
            else {
                this.out("virtual ");
            }
            this.out(type === undefined ? "void " + symbol.name : define(symbol.name, type, program, this._options));
            this.out("(");
            if (s.parameters !== undefined) {
                var dot = "";
                for (let param of s.parameters) {
                    let name = checker.getSymbolAtLocation(param.name);
                    let type = param.type === undefined ? undefined : getTypeAtLocation(param.type, checker);
                    this.out(dot);
                    this.out(define(name.name, type, program, this._options));
                    dot = ",";
                }
            }
            this.out(");\n");
        }
        classMethods(s, program) {
            let v = this;
            ts.forEachChild(s, (node) => {
                if (ts.isMethodDeclaration(node)) {
                    v.classMethod(node, program);
                }
            });
        }
        classConstructor(s, program) {
            let checker = program.getTypeChecker();
            let p = s.parent;
            let psymbol = checker.getSymbolAtLocation(p.name);
            this.level(-1);
            this.out("public:\n");
            this.level();
            this.out(psymbol.name);
            this.out("(");
            var vs = [];
            for (let param of s.parameters) {
                let type = param.type === undefined ? undefined : getTypeAtLocation(param.type, checker);
                let name = checker.getSymbolAtLocation(param.name);
                vs.push(define(name.name, type, program, this._options));
            }
            this.out(vs.join(","));
            this.out(");\n\n");
        }
        classDefaultConstructor(p, program) {
            let checker = program.getTypeChecker();
            let psymbol = checker.getSymbolAtLocation(p.name);
            this.level(-1);
            this.out("public:\n");
            this.level();
            this.out(psymbol.name);
            this.out("(");
            this.out(");\n\n");
        }
        class(s, program) {
            this.classStart(s, program);
            let v = this;
            var hasConstructor = false;
            ts.forEachChild(s, (node) => {
                if (ts.isPropertyDeclaration(node)) {
                    v.classProperty(node, program);
                }
                else if (ts.isGetAccessorDeclaration(node)) {
                    v.classGetter(node, program, true);
                }
                else if (ts.isSetAccessorDeclaration(node)) {
                    v.classSetter(node, program, true);
                }
                else if (ts.isMethodDeclaration(node)) {
                    v.classMethod(node, program);
                }
                else if (ts.isConstructorDeclaration(node)) {
                    v.classConstructor(node, program);
                    hasConstructor = true;
                }
            });
            if (!hasConstructor) {
                this.classDefaultConstructor(s, program);
            }
            this.classEnd();
        }
        interfaceStart(node, program) {
            let checker = program.getTypeChecker();
            let name = checker.getSymbolAtLocation(node.name);
            this.level();
            this.out("class ");
            this.out(name.name);
            this.heritageClauses(node.heritageClauses, false);
            this.out(" {\n");
            this._level++;
            this.level(-1);
            this.out("public:\n");
            console.info("[interface]", name.name, ">>");
        }
        interfaceEnd() {
            console.info("[interface] <<");
            this._level--;
            this.level();
            this.out("};\n\n");
        }
        interfaceObject(name, key, value) {
            this.level();
            this.out("typedef ");
            this.out(this._options.lib);
            this.out("::TObject<");
            this.out(key);
            this.out(",");
            this.out(value);
            this.out("> ");
            this.out(name);
            this.out(";\n\n");
        }
        interfaceGetter(s, program) {
            let checker = program.getTypeChecker();
            let name = checker.getSymbolAtLocation(s.name);
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            this.level();
            this.out("virtual ");
            this.out(getter(name.name, type, program, this._options));
            this.out(" = 0;\n");
        }
        interfaceSetter(s, program) {
            let checker = program.getTypeChecker();
            let name = checker.getSymbolAtLocation(s.name);
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            this.level();
            this.out("virtual ");
            this.out(setter(getSetSymbol(name.name), "v", type, program, this._options));
            this.out(" = 0;\n");
        }
        interfaceProperty(s, program) {
            var readonly = false;
            if (s.modifiers !== undefined) {
                for (let element of s.modifiers) {
                    if (element.kind == ts.SyntaxKind.ReadonlyKeyword) {
                        readonly = true;
                    }
                }
            }
            this.interfaceGetter(s, program);
            if (!readonly) {
                this.interfaceSetter(s, program);
            }
        }
        interfacePropertys(s, program) {
            let v = this;
            ts.forEachChild(s, (node) => {
                if (ts.isPropertySignature(node)) {
                    v.interfaceProperty(node, program);
                }
            });
        }
        interfaceMethod(s, program) {
            let checker = program.getTypeChecker();
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            let symbol = checker.getSymbolAtLocation(s.name);
            this.level();
            this.out("virtual ");
            this.out(type === undefined ? "void " + symbol.name : define(symbol.name, type, program, this._options));
            this.out("(");
            if (s.parameters !== undefined) {
                var dot = "";
                for (let param of s.parameters) {
                    let name = checker.getSymbolAtLocation(param.name);
                    let type = param.type === undefined ? undefined : getTypeAtLocation(param.type, checker);
                    this.out(dot);
                    this.out(define(name.name, type, program, this._options));
                    dot = ",";
                }
            }
            this.out(") = 0;\n");
        }
        interfaceMethods(s, program) {
            let v = this;
            ts.forEachChild(s, (node) => {
                if (ts.isMethodSignature(node)) {
                    v.interfaceMethod(node, program);
                }
            });
        }
        interface(s, program) {
            var index;
            ts.forEachChild(s, (node) => {
                if (ts.isIndexSignatureDeclaration(node)) {
                    index = node;
                }
            });
            if (index === undefined) {
                this.interfaceStart(s, program);
                let v = this;
                ts.forEachChild(s, (node) => {
                    if (ts.isPropertySignature(node)) {
                        v.interfaceProperty(node, program);
                    }
                    else if (ts.isMethodSignature(node)) {
                        v.interfaceMethod(node, program);
                    }
                });
                this.interfaceEnd();
            }
            else {
                let checker = program.getTypeChecker();
                let name = checker.getSymbolAtLocation(s.name);
                var key;
                let type = index.type === undefined ? undefined : getTypeAtLocation(index.type, checker);
                for (let param of index.parameters) {
                    let pType = param.type === undefined ? undefined : getTypeAtLocation(param.type, checker);
                    key = pType;
                    break;
                }
                this.interfaceObject(name.name, getType(key, this._options), getType(type, this._options));
            }
        }
        function(s, program) {
            if (s.name === undefined) {
                return;
            }
            let checker = program.getTypeChecker();
            let symbol = checker.getSymbolAtLocation(s.name);
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            console.info("[function]", symbol.name, ">>");
            this.level();
            if (type !== undefined) {
                this.out(define(symbol.name, type, program, this._options));
            }
            else {
                this.out("void ");
                this.out(symbol.name);
            }
            this.out("(");
            if (s.parameters !== undefined) {
                var dot = "";
                for (let param of s.parameters) {
                    let name = checker.getSymbolAtLocation(param.name);
                    let type = param.type === undefined ? undefined : getTypeAtLocation(param.type, checker);
                    this.out(dot);
                    this.out(define(name.name, type, program, this._options));
                    dot = ",";
                }
            }
            this.out(");\n\n");
            console.info("[function]", symbol.name, "<<");
        }
        implementGetter(s, program) {
            let checker = program.getTypeChecker();
            let name = checker.getSymbolAtLocation(s.name);
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            let p = s.parent;
            let pname = checker.getSymbolAtLocation(p.name);
            var isPublic = true;
            if (s.modifiers !== undefined) {
                for (let element of s.modifiers) {
                    if (element.kind == ts.SyntaxKind.PrivateKeyword) {
                        isPublic = false;
                        break;
                    }
                    else if (element.kind == ts.SyntaxKind.ProtectedKeyword) {
                        isPublic = false;
                        break;
                    }
                }
            }
            this.level();
            this.out(getter(pname.name + "::" + name.name, type, program, this._options));
            this.out("{\n");
            this._level++;
            if (ts.isPropertyDeclaration(s)) {
                this.level();
                this.out("return ");
                if (isPublic) {
                    this.out("_");
                }
                this.out(name.name);
                this.out(";\n");
            }
            else if (s.body !== undefined) {
                this.body(s.body, program, p);
            }
            this._level--;
            this.level();
            this.out("}\n\n");
        }
        implementSetter(s, program) {
            let checker = program.getTypeChecker();
            let name = checker.getSymbolAtLocation(s.name);
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            let p = s.parent;
            let pname = checker.getSymbolAtLocation(p.name);
            var isPublic = true;
            if (s.modifiers !== undefined) {
                for (let element of s.modifiers) {
                    if (element.kind == ts.SyntaxKind.PrivateKeyword) {
                        isPublic = false;
                        break;
                    }
                    else if (element.kind == ts.SyntaxKind.ProtectedKeyword) {
                        isPublic = false;
                        break;
                    }
                }
            }
            if (ts.isPropertyDeclaration(s)) {
                this.level();
                this.out(setter(pname.name + "::" + getSetSymbol(name.name), "__newValue__", type, program, this._options));
                this.out("{\n");
                this._level++;
                this.level();
                this.out("this->");
                if (isPublic) {
                    this.out("_");
                }
                this.out(name.name);
                this.out(" = __newValue__ ;\n");
                this._level--;
                this.level();
                this.out("}\n\n");
            }
            else {
                this.level();
                this.out(type === undefined ? "void " + name.name : define(name.name, type, program, this._options));
                this.out("(");
                if (s.parameters !== undefined) {
                    var dot = "";
                    for (let param of s.parameters) {
                        let name = checker.getSymbolAtLocation(param.name);
                        let type = param.type === undefined ? undefined : getTypeAtLocation(param.type, checker);
                        this.out(dot);
                        this.out(define(name.name, type, program, this._options));
                        dot = ",";
                    }
                }
                this.out("){\n");
                this._level++;
                if (s.body !== undefined) {
                    this.body(s.body, program, p);
                }
                this._level--;
                this.level();
                this.out("}\n\n");
            }
        }
        implementProperty(s, program) {
            var readonly = false;
            var isPublic = true;
            if (s.modifiers !== undefined) {
                for (let element of s.modifiers) {
                    if (element.kind == ts.SyntaxKind.ReadonlyKeyword) {
                        readonly = true;
                    }
                    else if (element.kind == ts.SyntaxKind.ProtectedKeyword || element.kind == ts.SyntaxKind.PrivateKeyword) {
                        isPublic = false;
                    }
                }
            }
            if (isPublic) {
                this.implementGetter(s, program);
                if (!readonly) {
                    this.implementSetter(s, program);
                }
            }
        }
        implementMethod(s, program) {
            let checker = program.getTypeChecker();
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            let name = checker.getSymbolAtLocation(s.name);
            let p = s.parent;
            let pname = checker.getSymbolAtLocation(p.name);
            this.level();
            this.out(define(pname.name + "::" + name.name, type, program, this._options));
            this.out("(");
            if (s.parameters !== undefined) {
                var dot = "";
                for (let param of s.parameters) {
                    let name = checker.getSymbolAtLocation(param.name);
                    let type = getTypeAtLocation(param.type, checker);
                    this.out(dot);
                    this.out(define(name.name, type, program, this._options));
                    dot = ",";
                }
            }
            this.out(") {\n");
            if (s.body !== undefined) {
                this._level++;
                this.body(s.body, program, p);
                this._level--;
            }
            this.level();
            this.out("}\n\n");
        }
        implementClass(s, program) {
            let v = this;
            var hasConstructor = false;
            ts.forEachChild(s, (node) => {
                if (ts.isPropertyDeclaration(node)) {
                    v.implementProperty(node, program);
                }
                else if (ts.isGetAccessorDeclaration(node)) {
                    v.implementGetter(node, program);
                }
                else if (ts.isSetAccessorDeclaration(node)) {
                    v.implementSetter(node, program);
                }
                else if (ts.isMethodDeclaration(node)) {
                    v.implementMethod(node, program);
                }
                else if (ts.isConstructorDeclaration(node)) {
                    v.implementConstructor(node, program);
                    hasConstructor = true;
                }
            });
            if (!hasConstructor) {
                this.implementDefaultConstructor(s, program);
            }
        }
        implementFunction(s, program) {
            let checker = program.getTypeChecker();
            let name = checker.getSymbolAtLocation(s.name);
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            this.level();
            if (type !== undefined) {
                this.out(define(name.name, type, program, this._options));
            }
            else {
                this.out("void ");
                this.out(name.name);
            }
            this.out("(");
            if (s.parameters !== undefined) {
                var dot = "";
                for (let param of s.parameters) {
                    let name = checker.getSymbolAtLocation(param.name);
                    let type = param.type === undefined ? undefined : getTypeAtLocation(param.type, checker);
                    this.out(dot);
                    this.out(define(name.name, type, program, this._options));
                    dot = ",";
                }
            }
            this.out(") {\n");
            if (s.body !== undefined) {
                this._level++;
                this.body(s.body, program, undefined);
                this._level--;
            }
            this.level();
            this.out("}\n\n");
        }
        implementInitializer(s, program) {
            let checker = program.getTypeChecker();
            let name = checker.getSymbolAtLocation(s.name);
            let type = s.type === undefined ? undefined : getTypeAtLocation(s.type, checker);
            let p = s.parent;
            var isPublic = true;
            if (s.modifiers !== undefined) {
                for (let element of s.modifiers) {
                    if (element.kind == ts.SyntaxKind.PrivateKeyword || ts.SyntaxKind.ProtectedKeyword) {
                        isPublic = false;
                        break;
                    }
                }
            }
            if (s.initializer !== undefined && ts.isObjectLiteralExpression(s.initializer)) {
                let e = s.initializer;
                if (type !== undefined && type.symbol !== undefined && type.symbol.name == "map") {
                    var count = 0;
                    for (let prop of e.properties) {
                        if (ts.isPropertyAssignment(prop)) {
                            count++;
                        }
                    }
                    if (count == 0) {
                        return;
                    }
                    this.level();
                    this.out("{\n");
                    {
                        this.level(1);
                        this.out(define("v", type, program, this._options));
                        this.out(" = this->");
                        if (isPublic) {
                            this.out("_");
                        }
                        this.out(name.name);
                        this.out(";\n");
                        for (let prop of e.properties) {
                            if (ts.isPropertyAssignment(prop)) {
                                let n = checker.getSymbolAtLocation(prop.name);
                                this.level(1);
                                this.out("v[");
                                this.out(JSON.stringify(n.name));
                                this.out("] = ");
                                this.expression(prop.initializer, program, p);
                                this.out(";\n");
                            }
                        }
                    }
                    this.level();
                    this.out("}\n");
                    return;
                }
                if (type === undefined || !type.isClassOrInterface()) {
                    return;
                }
                this.level();
                this.out("{\n");
                {
                    this.level(1);
                    this.out(type.symbol.name);
                    this.out(" * __V__ = new ");
                    this.out(type.symbol.name);
                    this.out("();\n");
                    for (let prop of e.properties) {
                        if (ts.isPropertyAssignment(prop)) {
                            let n = checker.getSymbolAtLocation(prop.name);
                            this.level(1);
                            this.out("v->");
                            this.out(getSetSymbol(n.name));
                            this.out("(");
                            this.expression(prop.initializer, program, p);
                            this.out(");\n");
                        }
                    }
                    this.level(1);
                    this.out("this->");
                    if (isPublic) {
                        this.out("_");
                    }
                    this.out(name.name);
                    this.out(" = __V__;\n");
                }
                this.level();
                this.out("}\n");
            }
            else if (s.initializer !== undefined) {
                this.level();
                if (isPublic) {
                    this.out("this->_");
                    this.out(name.name);
                    this.out("=");
                }
                else {
                    this.out("this->");
                    this.out(name.name);
                    this.out("=");
                }
                this.expression(s.initializer, program, p);
                this.out(";\n");
            }
            else {
                this.level();
                if (isPublic) {
                    this.out("this->_");
                    this.out(name.name);
                    this.out("=");
                }
                else {
                    this.out("this->");
                    this.out(name.name);
                    this.out("=");
                }
                this.out(getDefaultValue(type, this._options));
                this.out(";\n");
            }
        }
        implementDefaultConstructor(p, program) {
            let checker = program.getTypeChecker();
            let pname = checker.getSymbolAtLocation(p.name);
            this.level();
            this.out(pname.name);
            this.out("::");
            this.out(pname.name);
            this.out("(");
            this.out(") {\n");
            this._level++;
            let v = this;
            ts.forEachChild(p, (node) => {
                if (ts.isPropertyDeclaration(node)) {
                    v.implementInitializer(node, program);
                }
            });
            this._level--;
            this.level();
            this.out("}\n\n");
        }
        implementConstructor(s, program) {
            let checker = program.getTypeChecker();
            let p = s.parent;
            let pname = checker.getSymbolAtLocation(p.name);
            this.level();
            this.out(pname.name);
            this.out("::");
            this.out(pname.name);
            this.out("(");
            var vs = [];
            for (let param of s.parameters) {
                let type = param.type === undefined ? undefined : getTypeAtLocation(param.type, checker);
                let name = checker.getSymbolAtLocation(param.name);
                vs.push(define(name.name, type, program, this._options));
            }
            this.out(vs.join(","));
            this.out(") {\n");
            this._level++;
            let v = this;
            ts.forEachChild(p, (node) => {
                if (ts.isPropertyDeclaration(node)) {
                    v.implementInitializer(node, program);
                }
            });
            if (s.body !== undefined) {
                this.body(s.body, program, p);
            }
            this._level--;
            this.level();
            this.out("}\n\n");
        }
        expression(e, program, isa) {
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
                        let type = property.type === undefined ? undefined : getTypeAtLocation(property.type, checker);
                        if (isPublicProperty(property)) {
                            this.out("this->");
                            let name = checker.getSymbolAtLocation(e.name);
                            this.out("_");
                            this.out(name.name);
                        }
                        else {
                            this.out("this->");
                            let name = checker.getSymbolAtLocation(e.name);
                            this.out(name.name);
                        }
                        if (type != undefined && isObjectType(type)) {
                            this.out(".as()");
                        }
                    }
                    else {
                        this.out("this->");
                        this.out(name.name);
                        this.out("()");
                    }
                }
                else {
                    this.expression(e.expression, program, isa);
                    this.out("->");
                    this.out(name.name);
                    this.out("()");
                }
            }
            else if (ts.isBinaryExpression(e)) {
                this.expression(e.left, program, isa);
                this.out(e.operatorToken.getText());
                this.expression(e.right, program, isa);
            }
            else if (ts.isIdentifier(e)) {
                if (e.text == "undefined" || e.text == "null") {
                    this.out("nullptr");
                }
                else {
                    this.out(e.text);
                }
            }
            else if (ts.isCallExpression(e)) {
                if (ts.isPropertyAccessExpression(e.expression)) {
                    this.expression(e.expression.expression, program, isa);
                    this.out("->");
                    this.out(e.expression.name.escapedText);
                    this.out("(");
                    var vs = [];
                    for (let arg of e.arguments) {
                        this.expression(arg, program, isa);
                    }
                    this.out(vs.join(","));
                    this.out(")");
                }
                else {
                    this.out("(*(");
                    this.expression(e.expression, program, isa);
                    this.out("))(");
                    var vs = [];
                    for (let arg of e.arguments) {
                        this.expression(arg, program, isa);
                    }
                    this.out(vs.join(","));
                    this.out(")");
                }
            }
            else if (ts.isNewExpression(e)) {
                this.out("new ");
                var n = e.expression;
                var ns = [];
                while (1) {
                    if (ts.isPropertyAccessExpression(n)) {
                        ns.push(n.name.escapedText);
                        n = n.expression;
                    }
                    else if (ts.isToken(n)) {
                        ns.push(n.getText());
                        break;
                    }
                    else {
                        break;
                    }
                }
                this.out(ns.reverse().join("::"));
                this.out("(");
                var dot = "";
                if (e.arguments != undefined) {
                    for (let arg of e.arguments) {
                        this.out(dot);
                        this.expression(arg, program, isa);
                        dot = ",";
                    }
                }
                this.out(")");
            }
            else if (ts.isNumericLiteral(e)) {
                this.out(e.getText());
            }
            else if (ts.isStringLiteral(e)) {
                this.out(JSON.stringify(e.text));
            }
            else if (e.kind == ts.SyntaxKind.ThisKeyword) {
                this.out("this");
            }
            else if (e.kind == ts.SyntaxKind.FalseKeyword) {
                this.out("false");
            }
            else if (e.kind == ts.SyntaxKind.TrueKeyword) {
                this.out("true");
            }
            else if (e.kind == ts.SyntaxKind.UndefinedKeyword) {
                this.out("nullptr");
            }
            else if (e.kind == ts.SyntaxKind.NullKeyword) {
                this.out("nullptr");
            }
            else if (ts.isPostfixUnaryExpression(e)) {
                this.expression(e.operand, program, isa);
                if (e.operator == ts.SyntaxKind.PlusPlusToken) {
                    this.out("++");
                }
                else {
                    this.out("--");
                }
            }
            else if (ts.isPrefixUnaryExpression(e)) {
                if (e.operator == ts.SyntaxKind.PlusPlusToken) {
                    this.out("++");
                }
                else {
                    this.out("--");
                }
                this.expression(e.operand, program, isa);
            }
            else if (ts.isArrowFunction(e)) {
                let func = e;
                let closure = func.closure;
                this.out("(new ");
                this.out(this._options.lib);
                this.out("::Closure<");
                let args = [];
                let returnType = e.type === undefined ? undefined : checker.getTypeAtLocation(e.type);
                args.push(define("", returnType, program, this._options));
                for (let param of e.parameters) {
                    let vType = getTypeAtLocation(param.type, checker);
                    args.push(define("", vType, program, this._options));
                }
                this.out(args.join(","));
                this.out(">(");
                this.out(closure.name);
                this.out("))");
                for (let local of closure.locals) {
                    this.out("->as(");
                    this.out(JSON.stringify(local.name));
                    this.out(",");
                    this.out(this._options.lib);
                    this.out("::Any(");
                    this.out(local.name);
                    this.out("))");
                }
            }
            else if (ts.isIdentifier(e)) {
                this.out(e.text);
            }
            else if (ts.isElementAccessExpression(e)) {
                this.expression(e.expression, program, isa);
                this.out("[");
                this.expression(e.argumentExpression, program, isa);
                this.out("]");
            }
            else {
                this.out(e.getText());
                console.info("[EX]", e.kind, e.getText());
            }
        }
        statement(st, program, isa) {
            let checker = program.getTypeChecker();
            if (ts.isReturnStatement(st)) {
                this.level();
                this.out("return ");
                if (st.expression !== undefined) {
                    this.expression(st.expression, program, isa);
                }
                this.out(";\n");
            }
            else if (ts.isIfStatement(st)) {
                this.level();
                this.out("if(");
                this.expression(st.expression, program, isa);
                this.out(") ");
                this.statement(st.thenStatement, program, isa);
                if (st.elseStatement !== undefined) {
                    this.level();
                    this.out("else ");
                    this.statement(st.elseStatement, program, isa);
                }
            }
            else if (ts.isForStatement(st)) {
                this.level();
                this.out("for(");
                if (st.initializer !== undefined) {
                    if (ts.isVariableDeclarationList(st.initializer)) {
                        var dot = "";
                        for (let v of st.initializer.declarations) {
                            let n = checker.getSymbolAtLocation(v.name);
                            this.out(dot);
                            if (dot == "") {
                                let type = getTypeAtLocation(v.type, checker);
                                this.out(define(n.name, type, program, this._options));
                            }
                            else {
                                this.out(n.name);
                            }
                            if (v.initializer !== undefined) {
                                this.out(" = ");
                                this.expression(v.initializer, program, isa);
                            }
                            dot = ",";
                        }
                    }
                    else {
                        this.expression(st.initializer, program, isa);
                    }
                }
                this.out(";");
                if (st.condition !== undefined) {
                    this.expression(st.condition, program, isa);
                }
                this.out(";");
                if (st.incrementor !== undefined) {
                    this.expression(st.incrementor, program, isa);
                }
                this.out(") ");
                this.statement(st.statement, program, isa);
            }
            else if (ts.isWhileStatement(st)) {
                this.level();
                this.out("while(");
                this.expression(st.expression, program, isa);
                this.out(") ");
                this.statement(st.statement, program, isa);
            }
            else if (ts.isSwitchStatement(st)) {
                this.level();
                this.out("switch(");
                this.expression(st.expression, program, isa);
                this.out(") {\n");
                for (let clause of st.caseBlock.clauses) {
                    if (ts.isCaseClause(clause)) {
                        this.level();
                        this.out("case ");
                        this.expression(clause.expression, program, isa);
                        this.out(" :\n");
                        this._level++;
                        for (let s of clause.statements) {
                            this.statement(s, program, isa);
                        }
                        this._level--;
                    }
                    else {
                        this.level();
                        this.out("default:\n");
                        this._level++;
                        for (let s of clause.statements) {
                            this.statement(s, program, isa);
                        }
                        this._level--;
                    }
                }
                this.level();
                this.out("}\n");
            }
            else if (ts.isBlock(st)) {
                if (this._isNewLine) {
                    this.level();
                }
                this.out("{\n");
                this._level++;
                for (let v of st.statements) {
                    this.statement(v, program, isa);
                }
                this._level--;
                this.level();
                this.out("}\n");
            }
            else if (ts.isExpressionStatement(st)) {
                this.level();
                this.expression(st.expression, program, isa);
                this.out(";\n");
            }
            else if (ts.isVariableStatement(st)) {
                for (let v of st.declarationList.declarations) {
                    this.level();
                    let n = checker.getSymbolAtLocation(v.name);
                    let t = v.type === undefined ? undefined : getTypeAtLocation(v.type, checker);
                    this.out(define(n.name, t, program, this._options));
                    if (v.initializer !== undefined) {
                        this.out(" = (");
                        this.out(define("", t, program, this._options));
                        this.out(")");
                        this.expression(v.initializer, program, isa);
                    }
                    this.out(";\n");
                }
            }
            else if (ts.isBreakStatement(st)) {
                this.level();
                this.out("break;\n");
            }
            else if (ts.isContinueStatement(st)) {
                this.level();
                this.out("continue;\n");
            }
            else {
                console.info("[ST]", st.kind, st.getText());
            }
        }
        body(body, program, isa) {
            for (let st of body.statements) {
                this.statement(st, program, isa);
            }
        }
        closureSymbolsInFunction(s, program, isa) {
            let checker = program.getTypeChecker();
            let vs = [];
            let p = s.parent;
            let locals = new Map();
            while (p !== undefined) {
                var fn;
                if (ts.isArrowFunction(p)
                    || ts.isMethodDeclaration(p) || ts.isGetAccessorDeclaration(p)
                    || ts.isSetAccessorDeclaration(p) || ts.isFunctionDeclaration(p)) {
                    fn = p;
                }
                if (fn !== undefined && fn.locals !== undefined) {
                    let v = fn.locals;
                    for (let key of v.keys()) {
                        if (!locals.has(key)) {
                            locals.set(key, v.get(key));
                        }
                    }
                }
                if (ts.isMethodDeclaration(p) || ts.isGetAccessorDeclaration(p)
                    || ts.isSetAccessorDeclaration(p) || ts.isFunctionDeclaration(p)) {
                    break;
                }
                p = p.parent;
            }
            {
                let fn = s;
                let v = fn.locals;
                for (let key of v.keys()) {
                    locals.delete(key);
                }
            }
            function each(node) {
                if (ts.isIdentifier(node)) {
                    if (locals.has(node.text)) {
                        vs.push(checker.getSymbolAtLocation(node));
                    }
                }
                else {
                    ts.forEachChild(node, each);
                }
            }
            ts.forEachChild(s.body, each);
            return vs;
        }
        implementArrowFunction(s, program, isa) {
            let checker = program.getTypeChecker();
            let closure = {
                name: "__closure__func__" + s.pos + "_" + s.end + "__",
                locals: this.closureSymbolsInFunction(s, program, isa)
            };
            s.closure = closure;
            let returnType = s.type === undefined ? undefined : checker.getTypeAtLocation(s.type);
            this.level();
            this.out("inline static ");
            this.out(define("", returnType, program, this._options));
            this.out(" ");
            this.out(closure.name);
            this.out("(");
            let args = [];
            args.push(this._options.lib + "::_Closure * __Closure__");
            for (let param of s.parameters) {
                let n = checker.getSymbolAtLocation(param.name);
                let vType = getTypeAtLocation(param.type, checker);
                args.push(define(n.name, vType, program, this._options));
            }
            this.out(args.join(","));
            this.out(") {\n");
            this._level++;
            for (let local of closure.locals) {
                this.level();
                if (ts.isVariableDeclaration(local.valueDeclaration) || ts.isParameter(local.valueDeclaration)) {
                    let type = local.valueDeclaration.type === undefined ? undefined : checker.getTypeAtLocation(local.valueDeclaration.type);
                    this.out(define(local.name, type, program, this._options));
                    this.out(" = __Closure__->get(");
                    this.out(JSON.stringify(local.name));
                    this.out(")");
                }
                this.out(";\n");
            }
            if (ts.isBlock(s.body)) {
                this.body(s.body, program, isa);
            }
            else {
                this.expression(s.body, program, isa);
            }
            this._level--;
            this.level();
            this.out("}\n\n");
        }
        implementClosure(node, program, isa) {
            let v = this;
            function each(node) {
                if (ts.isArrowFunction(node)) {
                    v.implementArrowFunction(node, program, isa);
                }
                else {
                    ts.forEachChild(node, each);
                }
            }
            ts.forEachChild(node, each);
        }
        import(s, program) {
            let name = s.moduleSpecifier.getText().replace(/\"/g, "");
            if (name.startsWith("./")) {
                this.include(name.substr(2) + ".h", false);
            }
            else if (!name.startsWith(".")) {
                this.include(name + "/" + name + ".h", true);
            }
            this.out("\n");
        }
        file(type, file, program, name) {
            if (type == FileType.Header) {
                let fileName = name.replace("/", "_").toLocaleUpperCase();
                this.out("#ifndef _" + fileName + "_H\n");
                this.out("#define _" + fileName + "_H\n\n");
                this.include(this._options.lib + "/" + this._options.lib + ".h", true);
                this.includeFile(file, program);
                this.out("\n");
                let v = this;
                let checker = program.getTypeChecker();
                if (this._options.namespace !== undefined) {
                    this.namespaceStart(this._options.namespace);
                }
                function each(node) {
                    if (ts.isModuleDeclaration(node)) {
                        if (node.body !== undefined) {
                            ts.forEachChild(node.body, each);
                        }
                    }
                    else if (ts.isInterfaceDeclaration(node)) {
                        v.interface(node, program);
                    }
                    else if (ts.isClassDeclaration(node) && node.name !== undefined) {
                        v.class(node, program);
                    }
                    else if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
                        v.function(node, program);
                    }
                    else if (ts.isImportDeclaration(node)) {
                        v.import(node, program);
                    }
                }
                ts.forEachChild(file, each);
                if (this._options.namespace !== undefined) {
                    this.namespaceEnd();
                }
                this.out("#endif\n\n");
            }
            else {
                this.include(name + ".h");
                this.out("\n");
                let v = this;
                let checker = program.getTypeChecker();
                if (this._options.namespace !== undefined) {
                    this.namespaceStart(this._options.namespace);
                }
                function each(node) {
                    if (ts.isModuleDeclaration(node)) {
                        if (node.body !== undefined) {
                            ts.forEachChild(node.body, each);
                        }
                    }
                    else if (ts.isClassDeclaration(node) && node.name !== undefined) {
                        v.implementClosure(node, program, node);
                        v.implementClass(node, program);
                    }
                    else if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
                        v.implementClosure(node, program, undefined);
                        v.implementFunction(node, program);
                    }
                }
                ts.forEachChild(file, each);
                if (this._options.namespace !== undefined) {
                    this.namespaceEnd();
                }
            }
        }
    }
    CC.Compiler = Compiler;
    ;
})(CC = exports.CC || (exports.CC = {}));
//# sourceMappingURL=CCompiler.js.map