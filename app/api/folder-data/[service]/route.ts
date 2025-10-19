import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

const DATA_FILES: Record<string, string> = {
  googledrive: "drive-database.json",
  dropbox: "dropbox-data.json",
  notion: "notion-data.json",
  onedrive: "onedrive-data.json",
};

export async function GET(
  _request: Request,
  { params }: { params: { service: string } },
) {
  const fileName = DATA_FILES[params.service];

  if (!fileName) {
    return NextResponse.json({ error: "Unknown service" }, { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "app",
    "(database)",
    fileName,
  );

  try {
    const contents = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(contents);
    return NextResponse.json(json);
  } catch (error) {
    console.error(`Failed to read data for ${params.service}`, error);
    return NextResponse.json(
      { error: "Failed to load data" },
      { status: 500 },
    );
  }
}
