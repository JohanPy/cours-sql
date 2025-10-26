
import init, { parse_sql } from './rust_parser/rust_parser.js';

let wasm_loaded = false;
let wasm_promise = null;

async function load_wasm() {
    if (!wasm_promise) {
        wasm_promise = init().then(() => {
            wasm_loaded = true;
        });
    }
    return wasm_promise;
}

async function resolveAliasToTable(editorText, alias) {
    await load_wasm();
    const result = parse_sql(editorText);
    return result.aliases[alias] || null;
}

async function parseFromAliases(editorText) {
    await load_wasm();
    return parse_sql(editorText);
}

load_wasm();

export { resolveAliasToTable, parseFromAliases };
