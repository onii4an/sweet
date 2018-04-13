App.admin = App.cable.subscriptions.create "AdminChannel",
  connected: ->
    # Called when the subscription is ready for use on the server

  disconnected: ->
    # Called when the subscription has been terminated by the server

  received: (data) ->
    console.log(Console[data['action']](data))

Console ={
  report: (data) ->
    $('.report_' + [data['id']]).remove()
}
