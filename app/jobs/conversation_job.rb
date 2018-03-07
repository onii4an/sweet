class ConversationJob < ApplicationJob
  queue_as :default

  def perform(action_name, args)
    send(action_name.to_sym, *args) if respond_to?(action_name.to_sym, :include_private)
  end

  private

  def create(boy_id, girl_id, conversation_id)
    # conversation_boy = Array.wrap([conversation_id, girl_id])
    # conversation_girl = Array.wrap([conversation_id, boy_id])
    sleep 2
    ActionCable.server.broadcast "user_#{girl_id}", action: :create, id: conversation_id
    ActionCable.server.broadcast "user_#{boy_id}", action: :create, id: conversation_id
    Boy.find(boy_id).update(waiting: false, in_a_conversation: true)
    Girl.find(girl_id).update(waiting: false, in_a_conversation: true)
  end
end
