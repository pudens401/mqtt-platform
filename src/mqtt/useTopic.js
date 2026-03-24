import { useEffect, useMemo } from 'react'
import { useMqtt } from './MqttContext.jsx'

export function useTopic(topic) {
  const { subscribe, unsubscribe, messagesByTopic, topicErrors } = useMqtt()

  useEffect(() => {
    if (!topic) return
    subscribe(topic)
    return () => {
      unsubscribe(topic)
    }
  }, [topic, subscribe, unsubscribe])

  const message = topic ? messagesByTopic[topic] : null
  const error = topic ? topicErrors[topic] || '' : ''

  return useMemo(() => ({ message, error }), [message, error])
}
