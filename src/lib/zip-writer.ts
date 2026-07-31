const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  CRC_TABLE[i] = c
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(arr: number[], v: number) {
  arr.push(v & 0xff, (v >>> 8) & 0xff)
}

function u32(arr: number[], v: number) {
  arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

export function createZip(entries: ZipEntry[]): Uint8Array {
  const local: number[] = []
  const central: number[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    u32(local, 0x04034b50)
    u16(local, 20)
    u16(local, 0)
    u16(local, 0)
    u16(local, 0)
    u16(local, 0)
    u32(local, crc)
    u32(local, size)
    u32(local, size)
    u16(local, nameBytes.length)
    u16(local, 0)
    for (const b of nameBytes) local.push(b)
    for (const b of entry.data) local.push(b)

    u32(central, 0x02014b50)
    u16(central, 20)
    u16(central, 20)
    u16(central, 0)
    u16(central, 0)
    u16(central, 0)
    u16(central, 0)
    u32(central, crc)
    u32(central, size)
    u32(central, size)
    u16(central, nameBytes.length)
    u16(central, 0)
    u16(central, 0)
    u16(central, 0)
    u16(central, 0)
    u32(central, 0)
    u32(central, offset)
    for (const b of nameBytes) central.push(b)

    offset += 30 + nameBytes.length + size
  }

  const centralStart = offset
  u32(central, 0x06054b50)
  u16(central, 0)
  u16(central, 0)
  u16(central, entries.length)
  u16(central, entries.length)
  u32(central, central.length - 22)
  u32(central, centralStart)
  u16(central, 0)

  return new Uint8Array([...local, ...central])
}
