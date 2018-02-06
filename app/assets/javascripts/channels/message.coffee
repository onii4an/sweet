App.message = App.cable.subscriptions.create "MessageChannel",
  connected: ->
    # Called when the subscription is ready for use on the server

  disconnected: ->
    # Called when the subscription has been terminated by the server

  received: (data) ->
    console.log(Message[data['action']](data))
    # Called when there's incoming data on the websocket for this channel
Message ={
  create: (data) ->
    $('.messages').append(data['res'])
}
