import SwiftRs
import Tauri
import UIKit
import UniformTypeIdentifiers
import WebKit

final class MobileVaultPlugin: Plugin, UIDocumentPickerDelegate {
  private let bookmarkKey = "grimoire.mobileVaultBookmark.v1"
  private var activeURL: URL?
  private var activeAccess = false
  private var pendingPickerInvoke: Invoke?

  @objc public override func load(webview: WKWebView) {
    _ = try? restoreBookmark()
  }

  deinit {
    stopActiveAccess()
  }

  @objc public func pickVaultFolder(_ invoke: Invoke) {
    guard pendingPickerInvoke == nil else {
      invoke.reject("A vault picker is already open")
      return
    }

    DispatchQueue.main.async {
      guard let viewController = self.manager.viewController else {
        invoke.reject("The iOS document browser is unavailable")
        return
      }

      self.pendingPickerInvoke = invoke
      let picker = UIDocumentPickerViewController(
        forOpeningContentTypes: [UTType.folder],
        asCopy: false
      )
      picker.delegate = self
      picker.allowsMultipleSelection = false
      picker.modalPresentationStyle = .fullScreen
      viewController.present(picker, animated: true)
    }
  }

  @objc public func restoreVaultFolder(_ invoke: Invoke) {
    do {
      guard let url = try restoreBookmark() else {
        invoke.resolve(["vault": NSNull()])
        return
      }
      invoke.resolve(response(for: url))
    } catch {
      UserDefaults.standard.removeObject(forKey: bookmarkKey)
      stopActiveAccess()
      invoke.reject("Could not restore the selected vault: \(error.localizedDescription)")
    }
  }

  @objc public func clearVaultFolder(_ invoke: Invoke) {
    UserDefaults.standard.removeObject(forKey: bookmarkKey)
    stopActiveAccess()
    invoke.resolve()
  }

  func documentPicker(
    _ controller: UIDocumentPickerViewController,
    didPickDocumentsAt urls: [URL]
  ) {
    guard let invoke = pendingPickerInvoke else { return }
    pendingPickerInvoke = nil

    guard let url = urls.first else {
      invoke.resolve(["vault": NSNull()])
      return
    }

    do {
      let values = try url.resourceValues(forKeys: [.isDirectoryKey])
      guard values.isDirectory == true else {
        invoke.reject("Please select a folder for your Grimoire vault")
        return
      }
      try activate(url)
      try saveBookmark(for: url)
      invoke.resolve(response(for: url))
    } catch {
      stopActiveAccess()
      invoke.reject("Could not open the selected vault: \(error.localizedDescription)")
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    pendingPickerInvoke?.resolve(["vault": NSNull()])
    pendingPickerInvoke = nil
  }

  private func response(for url: URL) -> [String: Any] {
    return [
      "vault": [
        "url": url.absoluteString,
        "name": url.lastPathComponent,
      ]
    ]
  }

  private func activate(_ url: URL) throws {
    if activeURL == url && activeAccess { return }
    stopActiveAccess()
    guard url.startAccessingSecurityScopedResource() else {
      throw MobileVaultError.securityScopeUnavailable
    }
    activeURL = url
    activeAccess = true
  }

  private func stopActiveAccess() {
    if activeAccess {
      activeURL?.stopAccessingSecurityScopedResource()
    }
    activeURL = nil
    activeAccess = false
  }

  private func saveBookmark(for url: URL) throws {
    let data = try url.bookmarkData(
      options: [],
      includingResourceValuesForKeys: nil,
      relativeTo: nil
    )
    UserDefaults.standard.set(data, forKey: bookmarkKey)
  }

  private func restoreBookmark() throws -> URL? {
    if let activeURL, activeAccess { return activeURL }
    guard let data = UserDefaults.standard.data(forKey: bookmarkKey) else {
      return nil
    }

    var isStale = false
    let url = try URL(
      resolvingBookmarkData: data,
      options: [],
      relativeTo: nil,
      bookmarkDataIsStale: &isStale
    )
    try activate(url)
    if isStale { try saveBookmark(for: url) }
    return url
  }
}

private enum MobileVaultError: LocalizedError {
  case securityScopeUnavailable

  var errorDescription: String? {
    switch self {
    case .securityScopeUnavailable:
      return "iOS did not grant access to that folder"
    }
  }
}

@_cdecl("init_plugin_mobile_vault")
func initPlugin() -> Plugin {
  return MobileVaultPlugin()
}
