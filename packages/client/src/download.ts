/** Saves content as a file through the browser's normal download. */
export function download(fileName: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
