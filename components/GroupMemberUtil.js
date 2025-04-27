import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

export const configPath = './config/duplicateGroupCheck.yaml'
export let whitelist = { groups: {}, members: [] }
if (fs.existsSync(configPath)) {
  whitelist = YAML.parse(fs.readFileSync(configPath, 'utf8'))
}

export const groupDataFolder = './data/groupMembers'
if (!fs.existsSync(groupDataFolder)) {
  fs.mkdirSync(groupDataFolder, { recursive: true })
}

export function loadGroupMembers(groupId) {
  const filePath = path.join(groupDataFolder, `${groupId}.json`)
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8')
    return new Set(JSON.parse(data))
  }
  return new Set()
}

export function saveGroupMembers(groupId, members) {
  const filePath = path.join(groupDataFolder, `${groupId}.json`)
  fs.writeFileSync(filePath, JSON.stringify([...members]), 'utf8')
} 