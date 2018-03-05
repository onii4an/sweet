class MessageChannel < ApplicationCable::Channel
  def subscribed
    stream_from "cv_#{current_conversation.id}" if current_conversation.present?
  end

  def unsubscribed
    unless current_user.type == "Admin"
      ActionCable.server.broadcast "user_#{current_conversation.boy_id}", action: :unsubscribed
      ActionCable.server.broadcast "user_#{current_conversation.girl_id}", action: :unsubscribed
      Boy.find(current_conversation.boy_id).update in_a_conversation: false
      Girl.find(current_conversation.girl_id).update in_a_conversation: false
      current_conversation.update active: false
    end
    # Any cleanup needed when channel is unsubscribed
  end
end
