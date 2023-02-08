const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob')
const process = require('process')

// Enter your storage account name and shared key
const account = process.env.AZURE_STORAGE_NAME || ''
const accountKey = process.env.AZURE_STORAGE_KEY || ''

// Use StorageSharedKeyCredential with storage account and account key
// StorageSharedKeyCredential is only available in Node.js runtime, not in browsers
const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey)
if (!account) throw new Error('HOLD YOUR HORSES, NO ACCOUNT')
const blobServiceClient = new BlobServiceClient(
  `https://${account}.blob.core.windows.net`,
  sharedKeyCredential
)

module.exports = blobServiceClient
