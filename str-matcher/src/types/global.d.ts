declare global {
  interface Window {
    csvProcessingTimeout: NodeJS.Timeout;
  }
}

// This export is needed to make the file a module
export {};