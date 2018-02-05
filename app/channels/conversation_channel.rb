class ConversationChannel < ApplicationCable::Channel
  def subscribed
    stream_from "user_#{current_user.id}" if current_user
    stream_from "cv_#{Conversation.where(user_id: current_user.id).first.id}" if Conversation.where(user_id: current_user&.id).first.presence?
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
