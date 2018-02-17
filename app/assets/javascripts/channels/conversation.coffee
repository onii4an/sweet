App.conversation = App.cable.subscriptions.create "ConversationChannel",
  connected: ->
    # Called when the subscription is ready for use on the server

  disconnected: ->
    # Called when the subscription has been terminated by the server

  received: (data) ->
    console.log(Conversation[data['action']](data))
    # Called when there's incoming data on the websocket for this channel
Conversation ={
  create: (data) ->
    window.location.replace("/conversations/" + [data['id']])
}
