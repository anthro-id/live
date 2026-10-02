import { useState, Fragment, useEffect } from "react";

import { Text, Flex, SimpleGrid, type FlexProps, type TextProps } from "@mantine/core";

import OBSWebSocket from "obs-websocket-js";

export default function PresentationText() {
  return (
    <Fragment>
      {/* Opening */}
      <Opening />
    </Fragment>
  );
};

export interface OpeningTextEventData {
  type: "opening-text";
  message: [string, string];
};

export function Opening() {
  const [text, setText] = useState<[string, string] | null>(null);

  const obs = new OBSWebSocket();

  const textStyle: TextProps = {
    c: "white",
    fw: 500,
    size: "5rem",
    textWrap: "pretty"
  };

  const flexStyle: FlexProps = {
    direction: "column",
    w: "100%"
  };

  const handleConnection = async () => {
    await obs.connect();

    obs.addListener("CustomEvent", (eventData) => {
      const data = eventData as unknown as { type: string; message: [string, string] };
      
      if (!data || data.type !== "opening-text" || !Array.isArray(data.message) || data.message.length !== 2) {
        return;
      };

      return setText(data.message as [string, string]);
    });

    return;
  };

  useEffect(() => {
    handleConnection();

    return () => {
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    setTimeout(() => setText(null), 7500);
  }, [text]);

  if (!text) {
    return null;
  };

  return (
    <SimpleGrid cols={3} h={"100dvh"} px={"7.5rem"} py={"2.5rem"}>
      <Flex {...flexStyle} justify={"center"}>
        <Text {...textStyle} ta={"left"} >
          {text[0]}
        </Text>
      </Flex>

      <Flex {...flexStyle} align={"center"} justify={"flex-end"}>
        <Text size={"md"} fw={600} c={"dark.2"}>
          Live in Kuta, Bali, Indonesia.
        </Text>
      </Flex>

      <Flex {...flexStyle} align={"right"} justify={"center"}>
        <Text {...textStyle} ta={"right"}>
          {text[1]}
        </Text>
      </Flex>
    </SimpleGrid>
  );
};