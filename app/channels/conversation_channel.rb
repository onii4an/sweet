class ConversationChannel < ApplicationCable::Channel
  def subscribed
    stream_from "user_#{current_user.id}" if current_user
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
