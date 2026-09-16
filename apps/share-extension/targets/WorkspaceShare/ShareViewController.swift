import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
  private let message = UILabel()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    message.numberOfLines = 0
    message.textAlignment = .center
    message.text = "No supported text or link was shared."
    let done = UIButton(type: .system)
    done.setTitle("Done", for: .normal)
    done.addTarget(self, action: #selector(finish), for: .touchUpInside)
    let stack = UIStackView(arrangedSubviews: [message, done])
    stack.axis = .vertical
    stack.spacing = 24
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
      stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
      stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
    ])
    let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
    for provider in items.flatMap({ $0.attachments ?? [] }) {
      let type = provider.hasItemConformingToTypeIdentifier(UTType.url.identifier)
        ? UTType.url.identifier : UTType.plainText.identifier
      guard provider.hasItemConformingToTypeIdentifier(type) else { continue }
      provider.loadItem(forTypeIdentifier: type, options: nil) { [weak self] item, error in
        let text = (item as? URL)?.absoluteString ?? (item as? String) ?? error?.localizedDescription ?? "Unsupported item"
        DispatchQueue.main.async { self?.message.text = text }
      }
      break
    }
  }

  @objc private func finish() {
    extensionContext?.completeRequest(returningItems: nil)
  }
}
