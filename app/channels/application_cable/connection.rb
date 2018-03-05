module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user
    identified_by :current_conversation

    def connect
      self.current_user = User.find_by(id: cookies[:user_id])
      if current_user
        if current_user.type == "Boy"
          self.current_conversation = Conversation.where(boy_id: current_user.id)&.last
        end
        if current_user.type == "Girl"
          self.current_conversation = Conversation.where(girl_id: current_user.id)&.last
        end
      end
      reject_unauthorized_connection unless current_user
    end
  end
end
