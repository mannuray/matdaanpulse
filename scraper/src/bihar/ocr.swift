import Vision
import AppKit
// Usage: ocr <image> [cropFrom 0..1] → lines "y x text" (normalised page coords, top-left origin), sorted by y then x.
// cropFrom reads only the page's right part (x ≥ cropFrom): Vision misses some isolated numbers on a full page.
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let crop = CommandLine.arguments.count > 2 ? Double(CommandLine.arguments[2]) ?? 0 : 0
guard let img = NSImage(contentsOf: url), let full = img.cgImage(forProposedRect: nil, context: nil, hints: nil),
      let cg = full.cropping(to: CGRect(x: Int(Double(full.width) * crop), y: 0, width: full.width - Int(Double(full.width) * crop), height: full.height)) else { exit(1) }
let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
req.usesLanguageCorrection = false
try VNImageRequestHandler(cgImage: cg).perform([req])
var out: [(Double, Double, String)] = []
for o in req.results ?? [] { if let t = o.topCandidates(1).first { let b = o.boundingBox; out.append((1 - Double(b.midY), crop + Double(b.minX) * (1 - crop), t.string)) } }
for (y, x, s) in out.sorted(by: { abs($0.0 - $1.0) < 0.006 ? $0.1 < $1.1 : $0.0 < $1.0 }) { print(String(format: "%.4f %.4f %@", y, x, s)) }
