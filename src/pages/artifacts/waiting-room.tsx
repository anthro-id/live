import { useState, useEffect, useRef, type CSSProperties } from "react";
import dayjs from "dayjs";
import ms from "ms";
import OBSWebSocket, { type RequestBatchRequest, RequestBatchExecutionType } from "obs-websocket-js";

import shuffle from "lodash.shuffle";
import random from "lodash.random";

import { Text, Image, Box, Flex } from "@mantine/core";

const [restUrl, token] = (process.env.NEXT_PUBLIC_REDIS as string).split(" | ");
import { Redis } from "@upstash/redis";
const redis = new Redis({
  url: `https://${restUrl}`, token,
  enableTelemetry: false
});

const inputName: string = "Waiting Audio";
const currentTime = Date.now();

export type AudioProp = Record<"title" | "artist" | "path", string>;

export type TransitionActivationTypes = "box" | "logo" | "timer" | "song";

export interface BroadcastData {
  waitUntil: number;
};

export default function WaitingRoom() {
  const [time, setTime] = useState<number>(
    (currentTime + ms("3m")) - currentTime
  );

  const [states, setStates] = useState<TransitionActivationTypes[]>([]);

  const [end, setEnd] = useState<boolean>(false);
  const fadeOutRef = useRef<boolean>(false);

  const [currentSong, setCurrentSong] = useState<Omit<AudioProp, "path"> | null>(null);
  const audioList = useRef<AudioProp[]>([]);
  const audioIndex = useRef<number>(0);

  const obs = new OBSWebSocket();

  const innerTransition: CSSProperties = {
    transition: "opacity 125ms, transform 375ms var(--expoOut)"
  };

  const setAudioIndex = () => {
    const audio = audioList.current[audioIndex.current];
    setCurrentSong({ artist: audio.artist, title: audio.title });

    return obs.call("SetInputSettings", {
      inputName, inputSettings: {
        "local_file": audio.path
      }
    });
  };

  const handleWaitingAudio = async () => {
    await obs.connect();

    await obs.call("SetInputVolume", {
      inputName, inputVolumeMul: 0
    });

    const req = await fetch("/api/audio-list");
    const list = await req.json() as AudioProp[];

    const shuffledList = shuffle(list);
    audioList.current = shuffledList;

    await Promise.all([
      obs.call("SetInputVolume", {
        inputName, inputVolumeMul: 0.75
      }),

      setAudioIndex()
    ]);

    obs.addListener("MediaInputPlaybackEnded", async (props) => {
      if (props.inputName !== inputName) {
        return;
      };

      let incrementedIndex = audioIndex.current + 1;
      if (incrementedIndex > (shuffledList.length - 1)) {
        incrementedIndex = 0;
      };

      audioIndex.current = incrementedIndex;

      await setAudioIndex();

      return;
    });

    return;
  };

  const fadeOutAudio = async (durationMs: number = 3000, steps: number = 60) => {
    const { inputVolumeMul: startVol } = await obs.call('GetInputVolume', { inputName });
    const requests: RequestBatchRequest[] = [];

    for (let i = 1; i <= steps; i++) {
      requests.push({
        requestType: 'SetInputVolume',
        requestData: { inputName, inputVolumeMul: startVol * (1 - i / steps) },
      }, {
        requestType: 'Sleep',
        requestData: { sleepMillis: Math.round(durationMs / steps) },
      });
    };

    return obs.callBatch(requests, {
      haltOnFailure: true,
      executionType: RequestBatchExecutionType.SerialRealtime
    });
  };

  const showCurrentSong = () => {
    if (time <= ms("15s")) {
      return;
    };

    const exitDuration = 7500 + 250;

    setStates(prev => prev.filter(item => item !== "timer"));

    setTimeout(() => {
      setStates(prev => prev.concat("song"));
    }, 250);

    setTimeout(() => {
      setStates(prev => prev.filter(item => item !== "song"));
    }, exitDuration);

    setTimeout(() => {
      setStates(prev => prev.concat("timer"));
    }, exitDuration + 425);
    return;
  };

  const prepare = async () => {
    const data = await redis.json.get<BroadcastData>("broadcast");
    if (data !== null) {
      const _time = (data.waitUntil - currentTime);
      if (_time > ms("15s")) {
        setTime(_time);
      };
    };

    await handleWaitingAudio();

    obs.addListener("CurrentProgramSceneChanged", () => {
      return obs.call("SetInputVolume", {
        inputName, inputVolumeMul: 0
      });
    });

    const interval = setInterval(() => {
      return setTime((prev) => {
        const final = Math.max(0, prev - 1e3);
        if (final <= 0) {
          clearInterval(interval);
        };

        return final;
      });

    }, 1e3);

    setTimeout(() => {
      setStates(["box"]);

      setTimeout(() => setStates(prev => prev.concat("logo")), 250);

      setTimeout(() => setStates(prev => prev.concat("timer")), 375);
    }, 500);

    return;
  };

  useEffect(() => {
    prepare();

    return () => {
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    if (time <= 3000 && fadeOutRef.current === false) {
      fadeOutRef.current = true;
      fadeOutAudio();
    };

    if (time > 0) {
      return;
    };

    setTimeout(() => {
      setEnd(true);

      setTimeout(() => {
        if (!obs.identified) {
          return;
        };

        window.obsstudio.setCurrentScene("Production");
      }, 1250);
    }, 1000);


  }, [time]);

  useEffect(() => {
    if (states.includes("song")) {
      return;
    };

    setTimeout(() => showCurrentSong(), random(3750, 7500));
  }, [currentSong]);

  return (
    <Box px={"5rem"} py={"2.5rem"} pos={"absolute"} top={0} left={0}>
      <Flex pos={"relative"} styles={{ root: { transition: "clip-path 375ms var(--expoOut), width 500ms var(--expoOut)", clipPath: `inset(0 ${(states.includes("box") && end !== true) ? 0 : 100}% 0 0)` } }} h={72} w={states.includes("song") ? 640 : 185} bdrs={"sm"} align={"center"} gap={"xl"} px={"lg"} py={"md"} bg={"#ececec"}>
        <Image styles={{ root: { ...innerTransition, opacity: states.includes("logo") ? 1 : 0, transform: `translateX(${states.includes("logo") ? 0 : 7.5}px)` } }} src={"/img/aidblack.svg"} w={36} loading={"eager"} />

        <Text styles={{ root: { ...innerTransition, position: states.includes("song") ? "absolute" : undefined, opacity: states.includes("timer") ? 1 : 0, transform: `translateX(${states.includes("timer") ? 0 : 7.5}px)` } }} size={"1.75em"} fw={600} lh={1.25} miw={56}>
          {dayjs(time).format("mm:ss")}
        </Text>

        <Box pos={"absolute"} left={"5rem"} style={{ ...innerTransition, opacity: states.includes("song") ? 1 : 0, transform: `translateX(${states.includes("song") ? 0 : 7.5}px)` }}>
          <Flex direction={"column"} pos={"relative"} top={0} left={0} w={640}>
            <Text size={"sm"} lh={1.75}>
              Now playing
            </Text>

            <Text size={"md"} fw={600} lh={1.25}>
              {`${currentSong?.artist} - ${currentSong?.title}`}
            </Text>
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
};