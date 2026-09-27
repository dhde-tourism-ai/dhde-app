/**
 * Types for public/data/nodes.json: the node registry the Map reads
 * (ids, EN/JA names, coordinates, prefecture). Any number of nodes works.
 */
import type { NodeKey, VisitorMeasure } from './dashboard'

export interface Prefecture {
  id: string
  name: string
  name_ja: string
  /** [[south, west], [north, east]] */
  bounds: [[number, number], [number, number]]
}

export interface RegistryNode {
  id: NodeKey
  name: string
  name_ja: string
  role?: string
  role_ja?: string
  prefecture: string
  municipality?: string
  lat: number
  lon: number
  /** Priority nodes are shown by default. */
  priority: boolean
  measure?: VisitorMeasure
  secondary_measures?: VisitorMeasure[]
  colour?: string
  /** Other ids this node is known by (e.g. 'station' in the demo map). */
  aliases?: string[]
  /** Which side of the marker the label sits on (declutters close nodes). */
  label_dir?: 'left' | 'right' | 'top' | 'bottom'
  /** Coordinates are an approximate town / station centre. */
  coords_approx?: boolean
}

export interface NodeRegistry {
  generated_at: string
  note?: string
  prefectures: Prefecture[]
  nodes: RegistryNode[]
}
