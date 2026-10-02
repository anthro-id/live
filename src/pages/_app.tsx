import type { AppProps } from "next/app";

import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";

import "@/styles/root.css";

const theme = createTheme({
  fontFamily: "'General Sans'"
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider theme={theme}>
      <Component {...pageProps} />
    </MantineProvider>
  );
};