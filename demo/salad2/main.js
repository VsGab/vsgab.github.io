const utfDec = new TextDecoder()
const utfEnc = new TextEncoder()
const memory = new WebAssembly.Memory({ initial: 2, maximum: 2})
let wasm = null
let term_box = null
let vm_input = null  //  entire input to send to wasm in iobuff sized chunks
let editor = null
const $el = (id) => document.getElementById(id)


addEventListener("DOMContentLoaded", (_) => {
    term_box = $el("term-box")
    editor = CodeMirror.fromTextArea($el("editor"), {
        lineNumbers: true,
        theme: "solarized dark",
    });
    fetch("dev.sf").then(async (res) => {
        editor.setValue(await res.text())
        editor.focus()
        editor.execCommand("goDocEnd")
    })
    tuiInit($el("tui"))
});

function vm_array(addr, len) {
    return new Uint8Array(wasm.memory.buffer, addr, len)
}

function js_io_write(addr, len) {
    if (!len) return
    const arr = vm_array(addr, len)
    const msg = utfDec.decode(arr)
    term_box.textContent += msg
}

function js_io_read(addr, len) {
    if (!vm_input) return 0;
    const read_sz = Math.min(len, vm_input.length)
    const dst = vm_array(addr, len)
    dst.set(vm_input.slice(0, read_sz))
    vm_input = vm_input.slice(read_sz)
    return read_sz
}
function js_on_error(addr, len) {
    let msg = 'N/A'
    if (len) {
        const arr = vm_array(addr, len)
        msg = utfDec.decode(arr)
    }
    term_box.textContent += " ERR "
    term_box.textContent += msg
    throw new Error(msg)
}

function js_tui_pos(row, col) {
    tuiPos(row, col)
}

function js_tui_puts(addr, len) {
    const arr = vm_array(addr, len)
    const msg = utfDec.decode(arr)
    tuiPuts(msg)
    cursor[1] = cursor[1] + msg.length
}

function js_tui_putc(val) {
    const msg = utfDec.decode(new Uint8Array([val]))
    tuiPuts(msg)
}

function js_tui_clr() {
    tuiClr()
}

function js_tui_width() {
    return n_cols;
}

function js_tui_height() {
    return n_rows;
}

function set_vm_input(str) {
    vm_input = utfEnc.encode(str + "\n")
}


function rerun_code() {
    term_box.textContent = ''
    wasm.saladcore_js_init()
    set_vm_input(editor.getValue())
    wasm.saladcore_js_exec()
    editor.focus()
}

(async () => {
    const wasm_imports={js_io_write, js_io_read, js_on_error,
                        js_tui_pos, js_tui_puts, js_tui_clr,
                        js_tui_width, js_tui_height, js_tui_putc,
                        }
    // init wasm module
    const { instance } = await WebAssembly.instantiateStreaming(
        fetch("salad.wasm"), {env:wasm_imports}
    );
    wasm = instance.exports

})()