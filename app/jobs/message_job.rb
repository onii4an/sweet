class MessageJob < ApplicationJob
  queue_as :default

  def perform(action_name, args)
    send(action_name.to_sym, *args) if respond_to?(action_name.to_sym, :include_private)
  end

  private

  def create(message)
    ActionCable.server.broadcast "cv_#{message.conversation_id}", action: :create, res: ApplicationController.renderer.render(partial: 'messages/message', object: message)
  end
end
