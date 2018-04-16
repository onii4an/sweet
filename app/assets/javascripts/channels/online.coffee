App.online = App.cable.subscriptions.create "OnlineChannel",
  connected: ->
    # Called when the subscription is ready for use on the server

  disconnected: ->
    # Called when the subscription has been terminated by the server

  received: (data) ->
    console.log(Online[data['action']](data))

Online ={
  update: (data) ->
    $('.boy_online').replaceWith(data['boy_online'])
    $('.girl_online').replaceWith(data['girl_online'])
}
