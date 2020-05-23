// NPM
const azure = require('azure-storage')
const log = require('debug')('astrotrain-manager:helpers:queue')
const config = require('dos-config')
const { promisify } = require('util')

// Constants
const { accessKey } = config.azure.storage
const storageAccount = config.azure.storage.account
const queueName = config.azure.queue.webhooks

// Configuration
const queueService = azure.createQueueService(storageAccount, accessKey)

const options = {
  // up to 32 messages, default is 1
  numOfMessages: config.setup.numOfMessages,

  // delay in sec before the message is visible again, default is 30
  visibilityTimeout: config.setup.visibilityTimeout,
}

const createQueueMessage = promisify(queueService.createMessage).bind(queueService)
const getQueueMessage = promisify(queueService.getMessages).bind(queueService)
const deleteQueueMessage = promisify(queueService.deleteMessage).bind(queueService)

async function createMessage(message) {
  if (Object.prototype.toString.call(message) !== '[object Object]') {
    throw new Error(`"message" parameter must be of "Object" type`)
  }
  return await createQueueMessage(queueName, JSON.stringify(message));
}

async function getMessages({ parse = true } = {}) {
  const messages = await getQueueMessage(queueName, options)
  if (!parse) return messages
  messages.forEach(message => message.messageText = JSON.parse(message.messageText))
  return messages
}

async function deleteMessage(message) {
  const { messageId, popReceipt } = message

  if (!messageId || !popReceipt) {
    throw new Error(`
      Parameters "messageId" and "popReceipt" are mandatory for deleting a queue message.
      Received ${JSON.stringify(message)}
    `)
  }

  return await deleteQueueMessage(queueName, messageId, popReceipt)
}

async function processMessages(processor) {

  const messages = await getMessages()

  if (!messages.length) return

  const message = messages[0]

  log(`Got a new message with id: ${message.messageId}`)

  await processor(message)
  await deleteMessage(message)
}

module.exports = {
  createMessage,
  getMessages,
  deleteMessage,
  processMessages,
}