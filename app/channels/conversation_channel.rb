class ConversationChannel < ApplicationCable::Channel
  def subscribed
    stream_from "user_#{current_user.id}" if current_user
  end

  def unsubscribed
    current_user.update waiting: false
    # Any cleanup needed when channel is unsubscribed
  end
end
