
/**
 * Convenience for shortening firebase IDs which are SHA-256 HMACs in hex.
 */
export function shortenId(id: string): string {
  return `*${id.slice(-6)}`
}


const byteToHex: string[] = [];
for (let n = 0; n <= 0xff; ++n)
{
  const hexOctet = n.toString(16).padStart(2, "0");
  byteToHex.push(hexOctet);
}

/**
 * Return hex encoded bytes.
 */
export function hex(arrayBuffer: ArrayBuffer): string {
  const buff = new Uint8Array(arrayBuffer);
  const hexOctets = []; // new Array(buff.length) is even faster (preallocates necessary array size), then use hexOctets[i] instead of .push()

  for (let i = 0; i < buff.length; ++i)
    hexOctets.push(byteToHex[buff[i]]);

  return hexOctets.join("");
}
