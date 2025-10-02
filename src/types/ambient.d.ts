// Minimal ambient declarations to satisfy `tsc` without peer packages
// and Node type packages installed. These are intentionally loose.

// Peer module without published types (optional at runtime)
declare module 'bluebutton' {
  const anyBluebutton: any;
  export = anyBluebutton;
}

// Node built-ins and globals are provided by @types/node
