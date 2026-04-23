const { XMLParser } = require("fast-xml-parser");

class ApiError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const extractYouTubeVideoId = (url) => {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname.includes("youtu.be")) {
      return parsedUrl.pathname.replace("/", "");
    }

    if (parsedUrl.hostname.includes("youtube.com")) {
      if (parsedUrl.pathname === "/watch") {
        return parsedUrl.searchParams.get("v");
      }

      if (parsedUrl.pathname.startsWith("/shorts/")) {
        return parsedUrl.pathname.split("/shorts/")[1];
      }

      if (parsedUrl.pathname.startsWith("/embed/")) {
        return parsedUrl.pathname.split("/embed/")[1];
      }
    }

    return null;
  } catch (error) {
    return null;
  }
};

const getCaptionTracksFromPlayerData = (playerData) =>
  playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

const fetchCaptionTracks = async (videoId) => {
  const playerUrl = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
  const clientVersion = "20.10.38";

  const response = await fetch(playerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `com.google.android.youtube/${clientVersion} (Linux; U; Android 14)`,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion,
        },
      },
      videoId,
    }),
  });

  if (!response.ok) {
    throw new ApiError("Failed to fetch YouTube player metadata.", 422);
  }

  const playerData = await response.json();
  const tracks = getCaptionTracksFromPlayerData(playerData);

  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new ApiError("Transcript is unavailable for this video.", 422);
  }

  return tracks;
};

const extractJson3TranscriptText = (json) => {
  const events = Array.isArray(json?.events) ? json.events : [];
  const segments = events
    .flatMap((event) => (Array.isArray(event?.segs) ? event.segs : []))
    .map((seg) => seg?.utf8 || "")
    .filter(Boolean);

  return segments.join(" ").trim();
};

const extractXmlTranscriptText = (xml) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    textNodeName: "value",
    trimValues: true,
  });

  const parsed = parser.parse(xml);

  const transcriptTextNodes = parsed?.transcript?.text;
  if (transcriptTextNodes) {
    const nodes = Array.isArray(transcriptTextNodes)
      ? transcriptTextNodes
      : [transcriptTextNodes];

    const text = nodes
      .map((node) => (typeof node === "string" ? node : node?.value || ""))
      .join(" ")
      .trim();

    if (text) {
      return text;
    }
  }

  // Some transcripts are returned in <timedtext><body><p><s>...</s></p></body></timedtext> shape.
  const paragraphNodes = parsed?.timedtext?.body?.p;
  if (paragraphNodes) {
    const paragraphs = Array.isArray(paragraphNodes) ? paragraphNodes : [paragraphNodes];
    const text = paragraphs
      .map((paragraph) => {
        if (typeof paragraph === "string") {
          return paragraph;
        }

        if (paragraph?.s) {
          const segments = Array.isArray(paragraph.s) ? paragraph.s : [paragraph.s];
          return segments
            .map((segment) => (typeof segment === "string" ? segment : segment?.value || ""))
            .join(" ");
        }

        return paragraph?.value || "";
      })
      .join(" ")
      .trim();

    if (text) {
      return text;
    }
  }

  return "";
};

const fetchYouTubeTranscript = async (videoId) => {
  try {
    const captionTracks = await fetchCaptionTracks(videoId);
    const transcriptTrack = captionTracks[0];
    const transcriptUrl = transcriptTrack.baseUrl;

    if (!transcriptUrl) {
      throw new ApiError("Transcript track URL is missing.", 422);
    }

    const json3Url = transcriptUrl.includes("?")
      ? `${transcriptUrl}&fmt=json3`
      : `${transcriptUrl}?fmt=json3`;

    const json3Response = await fetch(json3Url);
    if (json3Response.ok) {
      const json3Raw = await json3Response.text();
      if (!json3Raw.trim().startsWith("<")) {
        try {
          const json3Payload = JSON.parse(json3Raw);
          const json3Text = extractJson3TranscriptText(json3Payload);
          if (json3Text) {
            return json3Text;
          }
        } catch (error) {
          // Fall back to XML transcript parsing below.
        }
      }
    }

    const transcriptResponse = await fetch(transcriptUrl);
    if (!transcriptResponse.ok) {
      throw new ApiError("Could not download transcript from YouTube.", 422);
    }

    const transcriptXml = await transcriptResponse.text();
    const xmlText = extractXmlTranscriptText(transcriptXml);
    if (!xmlText) {
      throw new ApiError("Transcript parsing returned no segments.", 422);
    }

    return xmlText;
  } catch (error) {
    const message = error?.message || "Unable to fetch YouTube transcript.";
    throw new ApiError(message, 422);
  }
};

module.exports = {
  extractYouTubeVideoId,
  fetchYouTubeTranscript,
};
