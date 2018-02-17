class ConversationJob < ApplicationJob
  queue_as :default

  def perform(action_name, args)
    self.send(action_name.to_sym, *args) if self.respond_to?(action_name.to_sym, :include_private)
  end

  private

  def create(boy_id, girl_id, conversation_id)
    # conversation_boy = Array.wrap([conversation_id, girl_id])
    # conversation_girl = Array.wrap([conversation_id, boy_id])
    ActionCable.server.broadcast_to "user_#{girl_id}", action: :create, id: conversation_id
    ActionCable.server.broadcast_to "user_#{boy_id}", action: :create, id: conversation_id
    Boy.find(boy_id).update(waiting: false)
    Girl.find(girl_id).update(waiting: false)
  end
end
