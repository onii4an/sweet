class MessageJob < ApplicationJob
  queue_as :default


  def perform(action_name, args)
    self.send(action_name.to_sym, *args) if self.respond_to?(action_name.to_sym, :include_private)
  end

  private

  def create(message)
    ActionCable.server.broadcast "cv_#{message.conversation_id}", user_id: message.user_id, message_body: message.body, action: :create, res: ApplicationController.renderer.render(partial: 'messages/message', object: message, alien: true)
  end
end
