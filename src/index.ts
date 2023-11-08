import { type Participant, registerPlugin } from '@pexip/plugin-api'

const callingAdps: Participant[] = []
const pendingAdps: Participant[] = []

const plugin = await registerPlugin({
  id: 'plugin-retry-adp',
  version: 0
})

plugin.events.participants.add((event) => {
  const participants = getParticipantsFromEvent(event)

  // Get if any ADP is trying to connect (It could be also an outgoing call)
  const adp = participants.filter((participant) => {
    if (
      participant.serviceType === 'connecting' &&
      participant.protocol === 'sip' &&
      participant.vendor === 'Unknown'
    ) {
      return true
    } else {
      return false
    }
  })

  // Remove the users that are already connected
  callingAdps.forEach((adp, index) => {
    const connected = participants.some((participant) => participant.uuid === adp.uuid && participant.serviceType !== 'connecting')
    if (connected) {
      // Remove from the array
      callingAdps.splice(index, 1)
    }
  })
  pendingAdps.forEach((adp, index) => {
    const connected = participants.some((participant) => participant.uuid === adp.uuid && participant.serviceType !== 'connecting')
    if (connected) {
      // Remove from the array
      pendingAdps.splice(index, 1)
    }
  })

  // Add the users to the array if not are already there
  adp.forEach((participant) => {
    const found = callingAdps.some((adp) => adp.uuid === participant.uuid)
    if (!found) {
      callingAdps.push(participant)
    }
  })
})

plugin.events.participantLeft.add(async (event) => {
  const participant = getParticipantFromEvent(event)
  const found = callingAdps.some((adp) => adp.uuid === participant.uuid)

  if (found) {
    pendingAdps.push(participant)
    await plugin.ui.showToast({ message: `Failed the dial out to ${participant.uri}` })
  }
})

const button = await plugin.ui.addButton({
  position: 'toolbar',
  icon: 'IconParticipant',
  tooltip: 'Pending ADPs',
  roles: ['chair']
})

button.onClick.add(async () => {
  if (pendingAdps.length === 0) {
    await plugin.ui.showPrompt({
      title: 'No pending ADP',
      description: 'There isn\'t any pending ADP (Automatically Dialed Participant) request.',
      prompt: {
        primaryAction: 'Close'
      }
    })
  } else {
    const form = await plugin.ui.addForm({
      title: 'Pending ADPs',
      description: 'Pending ADPs (Automatically Dialed Participant) detected. Do you want to retry to dial the participant?',
      form: {
        elements: {
          adp: {
            type: 'select',
            name: 'Select ADP',
            options: pendingAdps.map((participant) => ({
              id: participant.uri,
              label: participant.uri
            }))
          }
        },
        submitBtnTitle: 'Dial'
      }
    })
    form.onInput.add((input) => {
      console.log(input)
      if (input.adp != null) {
        for (let i = 0; i < pendingAdps.length; i++) {
          if (pendingAdps[i].uri === input.adp) {
            pendingAdps.splice(i, 1)
            break
          }
        }
        plugin.ui.showToast({ message: `Calling to ${input.adp}` })
          .catch((e) => { console.error(e) })
        plugin.conference.dialOut({
          protocol: 'sip',
          role: 'GUEST',
          destination: input.adp
        })
          .catch((e) => { console.error(e) })
      }
      form.remove().catch((e) => { console.error(e) })
    })
  }
})

const getParticipantFromEvent = (event: any): Participant => {
  let participant: Participant
  if (event.participant != null) {
    participant = event.participant as Participant
  } else {
    participant = event as unknown as Participant
  }
  console.log(event)
  console.log(participant)
  return participant
}

const getParticipantsFromEvent = (event: any): Participant[] => {
  let participants: Participant[]
  if (event.participants != null) {
    participants = event.participants as Participant[]
  } else {
    participants = event as unknown as Participant[]
  }
  return participants
}
