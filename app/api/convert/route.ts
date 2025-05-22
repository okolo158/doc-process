import { NextRequest } from "next/server";
import {
  UploadFileRequest,
  GetParagraphsRequest,
  GetRunsRequest,
  WordsApi,
} from "asposewordscloud";
import Busboy from "busboy";
import { randomUUID } from "crypto";
import { Readable } from "stream";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to convert async Busboy parsing into a Promise
function parseForm(
  req: NextRequest
): Promise<{ buffer: Buffer; filename: string }> {
  return new Promise((resolve, reject) => {
    const buffers: Uint8Array[] = [];
    let filename = `upload-${randomUUID()}.docx`;

    const busboy = Busboy({
      headers: Object.fromEntries(req.headers.entries()),
    });

    busboy.on("file", (_fieldname, file, info) => {
      filename = info.filename || filename;
      file.on("data", (data: Uint8Array) => buffers.push(data));
    });

    busboy.on("finish", () => {
      resolve({ buffer: Buffer.concat(buffers), filename });
    });

    busboy.on("error", reject);

    const readable = Readable.fromWeb(req.body as any);
    readable.pipe(busboy);
  });
}

export async function POST(req: NextRequest) {
  try {
    // Validate environment variables
    const appSid = process.env.ASPOSE_APP_SID;
    const appKey = process.env.ASPOSE_APP_KEY;

    if (!appSid || !appKey) {
      throw new Error(
        "ASPOSE_APP_SID and ASPOSE_APP_KEY must be set in environment variables."
      );
    }

    const { buffer, filename } = await parseForm(req);

    const wordsApi = new WordsApi(appSid, appKey);

    // Step 1: Upload the file
    await wordsApi.uploadFile(
      new UploadFileRequest({
        fileContent: buffer,
        path: `uploads/${filename}`, // Use a proper directory path
      })
    );

    // Step 2: Get all paragraphs
    const paragraphsResponse = await wordsApi.getParagraphs(
      new GetParagraphsRequest({
        name: filename,
      })
    );

    const paragraphs =
      paragraphsResponse.body.paragraphs?.paragraphLinkList || [];

    // Step 3: For each paragraph, get runs and check for superscript
    const superscripts = await Promise.all(
      paragraphs.map(async (_para, i) => {
        const runsResponse = await wordsApi.getRuns(
          new GetRunsRequest({
            name: filename,
            paragraphPath: `paragraphs/${i}`,
          })
        );

        const runs = runsResponse.body.runs?.runList || [];
        return runs
          .filter((run) => run.font?.superscript)
          .map((run) => run.text);
      })
    );

    const flattenedSuperscripts = superscripts.flat();

    console.log("Superscript texts found:", flattenedSuperscripts);

    // Return a descriptive response if no superscripts are found
    if (flattenedSuperscripts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No superscripts found." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ superscripts: flattenedSuperscripts }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error occurred:", error); // Log full error for debugging
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
