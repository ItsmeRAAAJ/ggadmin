import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";

/** Open a (signed) file or external link in the in-app browser. */
export async function openUrl(url: string | null | undefined) {
  if (!url) return;
  try {
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  } catch {
    Alert.alert("Couldn't open link", "Please try again.");
  }
}
