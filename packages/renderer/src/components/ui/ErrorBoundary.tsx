import React from 'react';
interface Props { children: React.ReactNode }
interface State { hasError: boolean; error?: Error }
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div className="flex items-center justify-center h-screen text-red-600 p-8"><div><h2 className="text-xl font-bold mb-2">Fehler aufgetreten</h2><p>{this.state.error?.message}</p></div></div>;
    return this.props.children;
  }
}
