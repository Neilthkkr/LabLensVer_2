# Vendored browser runtimes

These files are kept in-repository so report contents are processed without
executing JavaScript fetched from third-party CDNs at runtime.

| Component | Version/source | Runtime files |
|---|---|---|
| PDF.js | `pdfjs-dist@3.11.174` | `pdfjs/pdf.min.js`, `pdfjs/pdf.worker.min.js` |
| Tesseract.js | `tesseract.js@5.1.0` | `tesseract/tesseract.min.js`, `tesseract/worker.min.js` |
| Tesseract core | `tesseract.js-core@5.1.0` | `tesseract/tesseract-core.wasm.js`, `tesseract/tesseract-core.wasm` |
| English OCR data | official Tesseract `4.0.0` model | `tessdata/eng.traineddata.gz` |

License texts are stored beside each component. Update versions deliberately,
review upstream changes, refresh the service-worker asset list, and rerun the
OCR benchmark before deployment.

## SHA-256

```text
5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946  pdfjs/pdf.min.js
feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b  pdfjs/pdf.worker.min.js
be397e903f26199d428b528e8d834cdca8064f95c82068fa34ec8c4d34fd9de9  tesseract/tesseract.min.js
2bcc88efb897e6a39517a05325b95e15a59e2bae1c74dee3deafb5a56aef846f  tesseract/worker.min.js
fe68f746dc186bb19e2c55de3514d3d6c4036ede53488b5a4db00dfe3f75e5f1  tesseract/tesseract-core.wasm.js
b47a852b19181ae0999f9d970c368cd351135a320ea978b35bd38602d8bcc0bc  tesseract/tesseract-core.wasm
ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468  tessdata/eng.traineddata.gz
```
