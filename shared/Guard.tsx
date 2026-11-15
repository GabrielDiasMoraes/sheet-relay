// A render error on the sheet becomes a message with a "back" button instead of a blank screen.
import { Component, ReactNode } from "react";
import { Text } from "react-native";
import type { Labels, UI } from "./types";

type Props = { ui: UI; labels: Labels; onBack: () => void; children: ReactNode };
export class Guard extends Component<Props, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    const { ui, labels, onBack } = this.props;
    if (!this.state.error) return this.props.children;
    return <ui.Frame title={labels.errTitle}><Text style={ui.t.err}>{this.state.error}</Text><Text style={ui.t.p}>{labels.errHint}</Text><ui.Button label={labels.back} onPress={onBack} /></ui.Frame>;
  }
}
