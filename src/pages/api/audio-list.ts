import type { NextApiRequest, NextApiResponse } from "next";

import path from "node:path";
import { readdir } from "node:fs/promises";

import { read as readTag } from "node-id3";

const audioDirPath = path.join(process.cwd(), "..", "live-content", "waiting-audios");

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const rawFilesList = await readdir(audioDirPath);

  const audioList = rawFilesList.map(file => {
    const filePath = path.join(audioDirPath, file);
    const tag = readTag(filePath);

    return {
      artist: tag.artist as string,
      title: tag.title as string,
      path: filePath
    };
  });

  return res.json(audioList);
};