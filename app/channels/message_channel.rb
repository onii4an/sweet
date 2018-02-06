class MessageChannel < ApplicationCable::Channel
  def subscribed
    stream_from "cv_#{Conversation.where(user_id: current_user.id).first.id}" if Conversation.where(user_id: current_user&.id).first.presence?
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
