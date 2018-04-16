class OnlineJob < ApplicationJob
  queue_as :default

  def perform(action_name, *args)
    send(action_name.to_sym, *args) if respond_to?(action_name.to_sym, :include_private)
  end

  private

  def update(boy_online, girl_online)
    ActionCable.server.broadcast 'online', action: :update, boy_online: boy_online, girl_online: girl_online
  end
end
