class ConversationJob < ApplicationJob
  queue_as :default

  def perform(action_name, args)
    self.send(action_name.to_sym, *args) if self.respond_to?(action_name.to_sym, :include_private)
  end

  private

  def create(boy_id, girl_id, conversation_id)
    conversation_boy = Array.wrap([conversation_id, girl_id])
    conversation_girl = Array.wrap([conversation_id, boy_id])
    ActionCable.server.broadcast "boy_#{boy_id}", girl_id: girl_id, action: :create, res: ApplicationController.renderer.render(partial: 'notification/notification', object: conversation_boy)
    ActionCable.server.broadcast "girl_#{girl_id}", boy_id: boy_id, action: :create, res: ApplicationController.renderer.render(partial: 'notification/notification', object: conversation_girl)
    current_boy.update(waiting: false) if current_boy
    current_girl.update(waiting: false) if current_girl
  end
end
