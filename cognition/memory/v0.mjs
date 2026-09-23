export function appendEpisodeV0(memory, event) {
  memory.push({
    id:`mem-${event.id}`,
    timestamp:event.timestamp,
    eventId:event.id,
    summary:typeof event.content==='string'?event.content:JSON.stringify(event.content),
    epistemicStatus:event.epistemicStatus
  });
}
