// Stub for optional jsPDF peer deps (html2canvas, dompurify) that we never
// use — jsPDF only needs them for its .html() renderer. Metro statically
// resolves every require() it finds, even ones gated behind a try/catch at
// runtime, so without this stub the web bundle fails to build.
module.exports = {};
