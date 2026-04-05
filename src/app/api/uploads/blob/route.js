import { put } from "@vercel/blob";

function sanitizeFolder(folder) {
  if (!folder) {
    return "uploads";
  }

  return folder
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "") || "uploads";
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function isPrivateStoreError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes("Cannot use public access on a private store");
}

function buildProxyUrl(requestUrl, blobUrl) {
  const proxyUrl = new URL("/api/uploads/blob", requestUrl);
  proxyUrl.searchParams.set("url", blobUrl);
  return proxyUrl.toString();
}

function getBlobToken() {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ??
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN ??
    process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN ??
    ""
  );
}

async function uploadToBlob(pathname, file, token) {
  try {
    const uploaded = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      token,
    });
    return { uploaded, access: "public" };
  } catch (error) {
    if (!isPrivateStoreError(error)) {
      throw error;
    }

    const uploaded = await put(pathname, file, {
      access: "private",
      addRandomSuffix: true,
      token,
    });
    return { uploaded, access: "private" };
  }
}

export async function GET(request) {
  const blobToken = getBlobToken();
  if (!blobToken) {
    return Response.json({ message: "Blob token is missing on server." }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const sourceUrl = requestUrl.searchParams.get("url");
  if (!sourceUrl) {
    return Response.json({ message: "Missing blob url." }, { status: 400 });
  }

  let parsedSourceUrl;
  try {
    parsedSourceUrl = new URL(sourceUrl);
  } catch {
    return Response.json({ message: "Invalid blob url." }, { status: 400 });
  }

  if (parsedSourceUrl.protocol !== "https:" || !parsedSourceUrl.hostname.endsWith(".blob.vercel-storage.com")) {
    return Response.json({ message: "Blob url does not match configured store." }, { status: 400 });
  }

  const upstream = await fetch(parsedSourceUrl.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${blobToken}`,
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return Response.json({ message: "Unable to fetch blob from private store.", status: upstream.status }, { status: 502 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  if (contentDisposition) {
    headers.set("content-disposition", contentDisposition);
  }
  headers.set("cache-control", "public, max-age=0, must-revalidate");

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}

export async function POST(request) {
  let formData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json({ message: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ message: "A file is required." }, { status: 400 });
  }

  const blobToken = getBlobToken();
  if (!blobToken) {
    return Response.json(
      {
        message:
          "Blob token is missing. Set BLOB_READ_WRITE_TOKEN (or VERCEL_BLOB_READ_WRITE_TOKEN) in .env.local and restart dev server.",
      },
      { status: 500 }
    );
  }

  const folder = sanitizeFolder(String(formData.get("folder") ?? ""));
  const filename = `${Date.now()}-${sanitizeFilename(file.name || "upload.bin")}`;
  const pathname = `${folder}/${filename}`;

  try {
    const { uploaded, access } = await uploadToBlob(pathname, file, blobToken);
    const proxyUrl = buildProxyUrl(request.url, uploaded.url);
    const shouldUseProxy = access === "private" || uploaded.url.includes(".private.blob.vercel-storage.com");

    return Response.json({
      url: shouldUseProxy ? proxyUrl : uploaded.url,
      blob_url: uploaded.url,
      pathname: uploaded.pathname,
      access,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown blob upload error.";
    console.error("Blob upload failed:", details);
    return Response.json({ message: "Upload failed. Check your blob token and store access.", details }, { status: 502 });
  }
}
