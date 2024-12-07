import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import { Caption } from "@remotion/captions";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import React, { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const fps = 30;

import { PaginatedSubtitles } from "./Subtitles";

export const AudioGramSchema = z.object({
  durationInSeconds: z.number().positive(),
  audioOffsetInSeconds: z.number().min(0),
  subtitlesFileName: z.string().refine(
    (s) => {
      const allowedExtensions = [".srt", ".json"];
      return allowedExtensions.some((extension) => s.endsWith(extension));
    },
    {
      message: "Subtitles file must be a .srt or .json file",
    },
  ),
  audioFileName: z.string().refine((s) => s.endsWith(".mp3"), {
    message: "Audio file must be a .mp3 file",
  }),
  coverImgFileName: z
    .string()
    .refine(
      (s) =>
        s.endsWith(".jpg") ||
        s.endsWith(".jpeg") ||
        s.endsWith(".png") ||
        s.endsWith(".bmp"),
      {
        message: "Image file must be a .jpg / .jpeg / .png / .bmp file",
      },
    ),
  titleText: z.string(),
  titleColor: zColor(),
  waveColor: zColor(),
  subtitlesTextColor: zColor(),
  subtitlesLinePerPage: z.number().int().min(0),
  subtitlesLineHeight: z.number().int().min(0),
  subtitlesZoomMeasurerSize: z.number().int().min(0),
  onlyDisplayCurrentSentence: z.boolean(),
  mirrorWave: z.boolean(),
  waveLinesToDisplay: z.number().int().min(0),
  waveFreqRangeStartIndex: z.number().int().min(0),
  waveNumberOfSamples: z.enum(["32", "64", "128", "256", "512"]),
});

type AudiogramCompositionSchemaType = z.infer<typeof AudioGramSchema>;

const AudioViz: React.FC<{
  readonly waveColor: string;
  readonly numberOfSamples: number;
  readonly freqRangeStartIndex: number;
  readonly waveLinesToDisplay: number;
  readonly mirrorWave: boolean;
  readonly audioSrc: string;
}> = ({
  waveColor,
  numberOfSamples,
  freqRangeStartIndex,
  waveLinesToDisplay,
  mirrorWave,
  audioSrc,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const audioData = useAudioData(audioSrc);

  if (!audioData) {
    return null;
  }

  const frequencyData = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples, // Use more samples to get a nicer visualisation
  });

  // Pick the low values because they look nicer than high values
  // feel free to play around :)
  const frequencyDataSubset = frequencyData.slice(
    freqRangeStartIndex,
    freqRangeStartIndex +
      (mirrorWave ? Math.round(waveLinesToDisplay / 2) : waveLinesToDisplay),
  );

  const frequenciesToDisplay = mirrorWave
    ? [...frequencyDataSubset.slice(1).reverse(), ...frequencyDataSubset]
    : frequencyDataSubset;

  return (
    <div className="audio-viz">
      {frequenciesToDisplay.map((v, i) => {
        return (
          <div
            key={i}
            className="bar"
            style={{
              minWidth: "1px",
              backgroundColor: waveColor,
              height: `${500 * Math.sqrt(v)}%`,
            }}
          />
        );
      })}
    </div>
  );
};

export const AudiogramComposition: React.FC<AudiogramCompositionSchemaType> = ({
  subtitlesFileName,
  audioFileName,
  coverImgFileName,
  titleText,
  titleColor,
  subtitlesTextColor,
  subtitlesLinePerPage,
  waveColor,
  waveNumberOfSamples,
  waveFreqRangeStartIndex,
  waveLinesToDisplay,
  subtitlesZoomMeasurerSize,
  subtitlesLineHeight,
  onlyDisplayCurrentSentence,
  mirrorWave,
  audioOffsetInSeconds,
}) => {
  const { durationInFrames } = useVideoConfig();

  const [handle] = useState(() => delayRender());
  const [subtitles, setSubtitles] = useState<Caption[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadSubtitles = async () => {
      try {
        const response = await fetch(subtitlesFileName);
        const data = subtitlesFileName.endsWith(".json")
          ? await response.json()
          : await response.text();

        setSubtitles(data);
        continueRender(handle);
      } catch (err) {
        console.log("Error fetching subtitles", err);
      }
    };

    loadSubtitles();
  }, [handle, subtitlesFileName]);

  if (!subtitles) {
    return null;
  }

  console.log("subtitles", subtitles);

  const audioOffsetInFrames = Math.round(audioOffsetInSeconds * fps);

  return (
    <div ref={ref}>
      <AbsoluteFill>
        <Sequence from={-audioOffsetInFrames}>
          <Audio pauseWhenBuffering src={audioFileName} />

          <div
            className="container"
            style={{
              fontFamily: "IBM Plex Sans",
            }}
          >
            <div className="row">
              <Img className="cover" src={coverImgFileName} />

              <div className="title" style={{ color: titleColor }}>
                {titleText}
              </div>
            </div>

            <div>
              <AudioViz
                audioSrc={audioFileName}
                mirrorWave={mirrorWave}
                waveColor={waveColor}
                numberOfSamples={Number(waveNumberOfSamples)}
                freqRangeStartIndex={waveFreqRangeStartIndex}
                waveLinesToDisplay={waveLinesToDisplay}
              />
            </div>

            <div
              style={{ lineHeight: `${subtitlesLineHeight}px` }}
              className="captions"
            >
              <PaginatedSubtitles
                subtitles={subtitles}
                startFrame={audioOffsetInFrames}
                endFrame={audioOffsetInFrames + durationInFrames}
                linesPerPage={subtitlesLinePerPage}
                subtitlesTextColor={subtitlesTextColor}
                subtitlesZoomMeasurerSize={subtitlesZoomMeasurerSize}
                subtitlesLineHeight={subtitlesLineHeight}
                onlyDisplayCurrentSentence={onlyDisplayCurrentSentence}
              />
            </div>
          </div>
        </Sequence>
      </AbsoluteFill>
    </div>
  );
};
