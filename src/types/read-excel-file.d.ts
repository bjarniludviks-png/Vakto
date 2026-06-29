// Minimal ambient types — the package ships ESM-only types via an exports map
// that our TS resolution doesn't pick up. We use it loosely (rows of unknown).
declare module "read-excel-file" {
  const readXlsxFile: (file: File | Blob, options?: unknown) => Promise<unknown[][]>;
  export default readXlsxFile;
}
